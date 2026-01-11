import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTranscriptionService } from "@/lib/transcription";
import { deepRefineTranscript, applyDeepRefinements } from "@/lib/transcription/refinement";
import { generateAndSaveSummary } from "@/lib/ai";
import { generateEmbeddings, chunkTranscriptForEmbedding } from "@/lib/ai/embeddings";
import { extractEntities, EntityType } from "@/lib/ai/entities";
import { extractRelationships, isValidRelationshipType } from "@/lib/ai/relationships";
import { runSingleQuery } from "@/lib/neo4j/client";

// Valid entity types - must match EntityType from entities.ts
const VALID_ENTITY_TYPES: readonly string[] = [
  "person", "organization", "project", "topic",
  "location", "date", "product", "technology", "other"
];

function isValidEntityType(type: string): type is EntityType {
  return VALID_ENTITY_TYPES.includes(type);
}

/**
 * Sanitize string for use as Neo4j label to prevent Cypher injection
 * Only allows alphanumeric characters and underscores
 */
function sanitizeNeo4jLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, '_');
}

const DEFAULT_PROCESSING_TIMEOUT_MINUTES = 180;
const DEFAULT_ORPHANED_JOB_GRACE_MINUTES = 10;

function parseTimeoutMinutes(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sessions/[id]/transcription-status - Check async transcription status
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the session
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // If not processing, return current status
  if (session.status !== "processing") {
    return NextResponse.json({
      status: session.status,
      completed: session.status === "completed",
    });
  }

  const timeoutMinutes = parseTimeoutMinutes(
    process.env.TRANSCRIPTION_PROCESSING_TIMEOUT_MINUTES,
    DEFAULT_PROCESSING_TIMEOUT_MINUTES
  );
  const orphanedGraceMinutes = parseTimeoutMinutes(
    process.env.TRANSCRIPTION_ORPHANED_JOB_GRACE_MINUTES,
    DEFAULT_ORPHANED_JOB_GRACE_MINUTES
  );

  const processingStartedAt = session.processing_started_at || session.updated_at || session.created_at;
  const processingStartTime = new Date(processingStartedAt);
  const processingElapsedMs = Number.isNaN(processingStartTime.getTime())
    ? 0
    : Date.now() - processingStartTime.getTime();

  if (processingElapsedMs > timeoutMinutes * 60 * 1000) {
    const timeoutMessage = `Transcription timed out after ${timeoutMinutes} minutes. Please retry.`;

    await supabase
      .from("sessions")
      .update({
        status: "expired",
        transcription_job_id: null,
        processing_started_at: null,
        transcription_error: timeoutMessage,
        transcription_error_code: "timeout",
      })
      .eq("id", sessionId);

    return NextResponse.json({
      status: "expired",
      completed: false,
      error: timeoutMessage,
      code: "TRANSCRIPTION_TIMEOUT",
    });
  }

  // If no job ID, something is wrong
  if (!session.transcription_job_id) {
    if (processingElapsedMs > orphanedGraceMinutes * 60 * 1000) {
      const orphanedMessage = "Transcription job was not created. Please retry.";

      await supabase
        .from("sessions")
        .update({
          status: "failed",
          transcription_job_id: null,
          processing_started_at: null,
          transcription_error: orphanedMessage,
          transcription_error_code: "orphaned_job",
        })
        .eq("id", sessionId);

      return NextResponse.json({
        status: "failed",
        completed: false,
        error: orphanedMessage,
        code: "TRANSCRIPTION_JOB_ORPHANED",
      });
    }

    return NextResponse.json({
      status: "processing",
      jobStatus: "unknown",
      message: "No job ID found - transcription may be running synchronously",
    });
  }

  try {
    // Check job status with RunPod
    const transcriptionService = getTranscriptionService();
    const jobStatus = await transcriptionService.checkAsyncJobStatus(session.transcription_job_id);

    // Handle different job states
    if (jobStatus.status === "COMPLETED") {
      // Parse the transcription result
      const result = transcriptionService.parseAsyncJobOutput(jobStatus);

      // Check if transcript already exists (in case of retry after partial failure)
      const { data: existingTranscript } = await supabase
        .from("transcripts")
        .select("id")
        .eq("session_id", sessionId)
        .single();

      let transcript;
      if (existingTranscript) {
        // Transcript already exists - use it
        console.log(`Transcript already exists for session ${sessionId}, using existing`);
        transcript = existingTranscript;
      } else {
        // Save new transcript to database
        const { data: newTranscript, error: transcriptError } = await supabase
          .from("transcripts")
          .insert({
            session_id: sessionId,
            language: result.language,
            full_text: result.fullText,
          })
          .select()
          .single();

        if (transcriptError) {
          throw new Error(`Failed to save transcript: ${transcriptError.message}`);
        }
        transcript = newTranscript;
      }

      // Save transcript segments (raw from ASR)
      if (result.segments.length > 0) {
        const segments = result.segments.map((seg, index) => ({
          transcript_id: transcript.id,
          speaker_id: seg.speaker.toLowerCase().replace(/\s+/g, "_"),
          speaker_name: seg.speaker,
          text: seg.text,
          start_time: seg.start,
          end_time: seg.end,
          segment_order: index,
        }));

        const { error: segmentsError } = await supabase
          .from("transcript_segments")
          .insert(segments);

        if (segmentsError) {
          console.error("Failed to save segments:", segmentsError);
        }
      }

      // Calculate unique speaker count from segments
      const uniqueSpeakers = new Set(result.segments.map((seg) => seg.speaker)).size;

      // IMPORTANT: Update status to "completed" IMMEDIATELY after saving transcript
      // This ensures session is marked complete even if Vercel times out during optional AI enhancements
      await supabase
        .from("sessions")
        .update({
          status: "completed",
          duration_seconds: result.duration,
          transcription_job_id: null, // Clear job ID
          participant_count: uniqueSpeakers,
          processing_started_at: null,
          transcription_error: null,
          transcription_error_code: null,
        })
        .eq("id", sessionId);

      // Now run optional AI enhancements - these can fail without breaking the flow
      // Run deep refinement
      try {
        // Fetch segments for refinement
        const { data: dbSegments } = await supabase
          .from("transcript_segments")
          .select("speaker_name, text, start_time, segment_order")
          .eq("transcript_id", transcript.id)
          .order("segment_order");

        if (dbSegments && dbSegments.length > 0) {
          // Run deep refinement
          const refinementResult = await deepRefineTranscript(dbSegments, {
            meetingContext: session.context || undefined,
            language: result.language === "he" ? "he" : "en",
          });

          // Apply refinements to database
          const { modifiedCount, deletedCount } = await applyDeepRefinements(
            supabase,
            transcript.id,
            refinementResult
          );

          console.log(`Deep refinement: ${modifiedCount} modified, ${deletedCount} deleted`);
        }
      } catch (refinementError) {
        // Log but don't fail - raw transcript is still available
        console.error("Deep refinement failed:", refinementError);
      }

      // Auto-generate summary
      try {
        await generateAndSaveSummary(supabase, sessionId, user.id, {
          context: session.context || undefined,
          language: result.language,
          transcriptId: transcript.id,
        });
        console.log(`Auto-summary generated for session ${sessionId}`);
      } catch (summaryError) {
        // Log but don't fail - summary can be generated manually later
        console.error("Auto-summary failed:", summaryError);
      }

      // Auto-generate embeddings for memory chat
      try {
        // Fetch segments after refinement
        const { data: finalSegments } = await supabase
          .from("transcript_segments")
          .select("speaker_id, speaker_name, text, start_time, segment_order")
          .eq("transcript_id", transcript.id)
          .is("is_deleted", false)
          .order("segment_order");

        if (finalSegments && finalSegments.length > 0) {
          // Delete any existing embeddings for this session
          await supabase.from("memory_embeddings").delete().eq("session_id", sessionId);

          // Chunk transcript for embedding
          const segments = finalSegments.map((seg) => ({
            speakerId: seg.speaker_id,
            speakerName: seg.speaker_name,
            text: seg.text,
            startTime: seg.start_time,
          }));

          const chunks = chunkTranscriptForEmbedding(segments);

          if (chunks.length > 0) {
            // Generate embeddings for all chunks
            const embeddings = await generateEmbeddings(chunks.map((c) => c.text));

            // Insert embeddings into database
            // Note: Supabase expects a string representation of the vector for pgvector
            const embeddingRecords = chunks.map((chunk, i) => ({
              user_id: user.id,
              session_id: sessionId,
              content: chunk.text,
              embedding: `[${embeddings[i].embedding.join(",")}]`,
              metadata: {
                speakerName: chunk.speakerName,
                startTime: chunk.startTime,
                segmentIndices: chunk.segmentIndices,
              },
            }));

            const { error: embeddingError } = await supabase
              .from("memory_embeddings")
              .insert(embeddingRecords);

            if (embeddingError) {
              console.error("Failed to save embeddings:", embeddingError);
            } else {
              console.log(`Auto-embeddings generated: ${chunks.length} chunks for session ${sessionId}`);
            }
          }
        }
      } catch (embeddingError) {
        // Log but don't fail - embeddings can be generated manually later
        console.error("Auto-embedding failed:", embeddingError);
      }

      // Auto-extract entities from transcript
      try {
        // Format segments for entity extraction
        const entitySegments = result.segments.map((seg) => ({
          speaker: seg.speaker,
          text: seg.text,
        }));

        // Extract entities using GPT-4o-mini
        const entityResult = await extractEntities(
          entitySegments,
          result.language || "he"
        );

        // Save entities to database (Supabase AND Neo4j)
        let extractedCount = 0;
        for (const entity of entityResult.entities) {
          // Check if entity already exists for this user
          const { data: existingEntity } = await supabase
            .from("entities")
            .select("id, mention_count")
            .eq("user_id", user.id)
            .eq("type", entity.type)
            .eq("normalized_value", entity.normalizedValue.toLowerCase())
            .single();

          let entityId: string;

          if (existingEntity) {
            // Update mention count
            entityId = existingEntity.id;
            await supabase
              .from("entities")
              .update({
                mention_count: existingEntity.mention_count + entity.mentions,
              })
              .eq("id", entityId);
          } else {
            // Create new entity
            const { data: newEntity, error: createError } = await supabase
              .from("entities")
              .insert({
                user_id: user.id,
                type: entity.type,
                value: entity.value,
                normalized_value: entity.normalizedValue.toLowerCase(),
                mention_count: entity.mentions,
              })
              .select("id")
              .single();

            if (createError) {
              console.error("Failed to create entity:", createError);
              continue;
            }
            entityId = newEntity.id;
          }

          // Sync entity to Neo4j (for graph visualization and relationships)
          // Validate entity type to prevent Cypher injection
          if (!isValidEntityType(entity.type)) {
            console.warn(`Invalid entity type: ${entity.type}, skipping Neo4j sync`);
          } else {
            // Sanitize label to prevent Cypher injection
            const typeLabel = sanitizeNeo4jLabel(
              entity.type.charAt(0).toUpperCase() + entity.type.slice(1)
            );
            const now = new Date().toISOString();
            try {
              await runSingleQuery(
                `
              MERGE (e:Entity:${typeLabel} {user_id: $userId, normalized_value: $normalizedValue})
              ON CREATE SET
                e.id = $entityId,
                e.display_value = $displayValue,
                e.mention_count = $mentions,
                e.confidence = 0.8,
                e.is_user_created = false,
                e.first_seen = datetime($now),
                e.last_seen = datetime($now),
                e.created_at = datetime($now)
              ON MATCH SET
                e.mention_count = e.mention_count + $mentions,
                e.last_seen = datetime($now)
              `,
              {
                userId: user.id,
                entityId,
                normalizedValue: entity.normalizedValue.toLowerCase(),
                displayValue: entity.value,
                mentions: entity.mentions,
                now,
              }
            );
          } catch (neo4jError) {
              console.error("Failed to sync entity to Neo4j:", neo4jError);
              // Continue - Supabase entity was created successfully
            }
          }

          // Create entity mention for this session
          await supabase.from("entity_mentions").insert({
            entity_id: entityId,
            session_id: sessionId,
            context: entity.context,
          });

          extractedCount++;
        }

        console.log(`Auto-entities extracted: ${extractedCount} for session ${sessionId}`);

        // Auto-extract relationships between entities (only if we have enough entities)
        if (extractedCount >= 2) {
          try {
            // Get the entities we just extracted
            const { data: entityMentions } = await supabase
              .from("entity_mentions")
              .select(`
                entities (
                  type,
                  value,
                  normalized_value
                )
              `)
              .eq("session_id", sessionId);

            const entities = (entityMentions || [])
              .map((m) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const entity = (m.entities as any);
                if (!entity) return null;
                return {
                  type: entity.type,
                  value: entity.value,
                  normalizedValue: entity.normalized_value,
                };
              })
              .filter((e): e is NonNullable<typeof e> => e !== null);

            if (entities.length >= 2) {
              // Format transcript for relationship extraction
              const formattedTranscript = result.segments
                .map((seg) => `${seg.speaker}: ${seg.text}`)
                .join("\n");

              const relResult = await extractRelationships(
                formattedTranscript,
                entities,
                result.language || "he"
              );

              // Save relationships - high confidence to Neo4j, low confidence as suggestions
              const CONFIDENCE_THRESHOLD = 0.7;
              let relSavedCount = 0;
              let suggestionCount = 0;

              for (const rel of relResult.relationships) {
                // Validate relationship type to prevent Cypher injection
                if (!isValidRelationshipType(rel.relationshipType)) {
                  console.warn(`Invalid relationship type: ${rel.relationshipType}, skipping`);
                  continue;
                }

                const confidence = rel.confidence ?? 0.8;
                // Sanitize relationship type to prevent Cypher injection
                const safeRelType = sanitizeNeo4jLabel(rel.relationshipType);

                // High confidence relationships are auto-created in Neo4j
                if (confidence >= CONFIDENCE_THRESHOLD) {
                  try {
                    const createResult = await runSingleQuery(
                      `
                      MATCH (source:Entity {user_id: $userId})
                      WHERE toLower(source.normalized_value) = toLower($sourceNormalized)
                         OR toLower(source.display_value) = toLower($sourceValue)
                      MATCH (target:Entity {user_id: $userId})
                      WHERE toLower(target.normalized_value) = toLower($targetNormalized)
                         OR toLower(target.display_value) = toLower($targetValue)
                      MERGE (source)-[r:${safeRelType}]->(target)
                      ON CREATE SET
                        r.confidence = $confidence,
                        r.context = $context,
                        r.source = 'ai',
                        r.session_id = $sessionId,
                        r.created_at = datetime()
                      RETURN source.id as sourceId, target.id as targetId
                      `,
                      {
                        userId: user.id,
                        sourceNormalized: rel.sourceValue.toLowerCase(),
                        sourceValue: rel.sourceValue,
                        targetNormalized: rel.targetValue.toLowerCase(),
                        targetValue: rel.targetValue,
                        confidence,
                        context: rel.context,
                        sessionId,
                      }
                    );

                    if (createResult) {
                      relSavedCount++;
                    }
                  } catch (relCreateError) {
                    console.error("Failed to create relationship:", relCreateError);
                  }
                } else {
                  // Low confidence relationships are saved as suggestions for user review
                  try {
                    // Look up entity IDs
                    const { data: sourceEntity } = await supabase
                      .from("entities")
                      .select("id")
                      .eq("user_id", user.id)
                      .ilike("normalized_value", rel.sourceValue.toLowerCase())
                      .single();

                    const { data: targetEntity } = await supabase
                      .from("entities")
                      .select("id")
                      .eq("user_id", user.id)
                      .ilike("normalized_value", rel.targetValue.toLowerCase())
                      .single();

                    await supabase
                      .from("relationship_suggestions")
                      .insert({
                        user_id: user.id,
                        session_id: sessionId,
                        source_entity_id: sourceEntity?.id || null,
                        target_entity_id: targetEntity?.id || null,
                        source_value: rel.sourceValue,
                        target_value: rel.targetValue,
                        source_type: rel.sourceType,
                        target_type: rel.targetType,
                        relationship_type: rel.relationshipType,
                        confidence,
                        context: rel.context,
                        status: "pending",
                      });

                    suggestionCount++;
                  } catch (suggestionError) {
                    console.error("Failed to save relationship suggestion:", suggestionError);
                  }
                }
              }

              console.log(`Auto-relationships: ${relSavedCount} created, ${suggestionCount} suggestions for session ${sessionId}`);
            }
          } catch (relError) {
            // Log but don't fail - relationships can be extracted manually later
            console.error("Auto-relationship extraction failed:", relError);
          }
        }
      } catch (entityError) {
        // Log but don't fail - entities can be extracted manually later
        console.error("Auto-entity extraction failed:", entityError);
      }

      // Status was already set to "completed" above - just return success
      return NextResponse.json({
        status: "completed",
        completed: true,
        transcript: {
          id: transcript.id,
          language: result.language,
          segmentCount: result.segments.length,
          duration: result.duration,
        },
      });
    }

    if (jobStatus.status === "FAILED" || jobStatus.status === "CANCELLED") {
      // Log detailed failure information for debugging
      console.error("Transcription job failed:", {
        sessionId,
        jobId: session.transcription_job_id,
        status: jobStatus.status,
        error: jobStatus.error,
        audioUrl: session.audio_url,
      });

      // Update session status to failed
      await supabase
        .from("sessions")
        .update({
          status: "failed",
          transcription_job_id: null,
          processing_started_at: null,
          transcription_error: userError,
          transcription_error_code: jobStatus.status === "CANCELLED" ? "job_cancelled" : "job_failed",
        })
        .eq("id", sessionId);

      // Parse the error to provide a user-friendly message
      let userError = jobStatus.error || "Transcription job failed";
      if (jobStatus.error?.includes("No segments meet minimum duration")) {
        userError = "ההקלטה קצרה מדי או לא מכילה דיבור מספיק לתמלול. נסה להקליט לפחות 10 שניות של דיבור רציף.";
      } else if (jobStatus.error?.includes("Diarization failed")) {
        userError = "לא הצלחנו לזהות דוברים בהקלטה. נסה להקליט עם דיבור ברור יותר.";
      }

      return NextResponse.json({
        status: "failed",
        completed: false,
        error: userError,
        details: {
          jobId: session.transcription_job_id,
          jobStatus: jobStatus.status,
          technicalError: jobStatus.error,
        },
      });
    }

    // Still processing (IN_QUEUE or IN_PROGRESS)
    return NextResponse.json({
      status: "processing",
      completed: false,
      jobStatus: jobStatus.status,
      jobId: session.transcription_job_id,
    });
  } catch (error) {
    // Log detailed error context for debugging
    console.error("Error checking transcription status:", {
      sessionId,
      jobId: session?.transcription_job_id,
      audioUrl: session?.audio_url,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check status",
        code: "TRANSCRIPTION_STATUS_ERROR",
        sessionId,
      },
      { status: 500 }
    );
  }
}
