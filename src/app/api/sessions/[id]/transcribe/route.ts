import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTranscriptionService } from "@/lib/transcription";
import { deepRefineTranscript, applyDeepRefinements } from "@/lib/transcription/refinement";
import { generateAndSaveSummary } from "@/lib/ai";
import { generateEmbeddings, chunkTranscriptForEmbedding } from "@/lib/ai/embeddings";
import { dedupeSegmentsByTimeAndText } from "@/lib/transcription/segments";
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/sessions/[id]/transcribe - Start transcription for a session
export async function POST(request: NextRequest, { params }: RouteParams) {
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

  if (!session.audio_url) {
    return NextResponse.json({ error: "Session has no audio file" }, { status: 400 });
  }

  // Check minimum audio file size (10KB minimum for meaningful transcription)
  // Very short recordings (<10KB) will fail diarization with "No segments meet minimum duration"
  try {
    const headResponse = await fetch(session.audio_url, { method: "HEAD" });
    const contentLength = parseInt(headResponse.headers.get("content-length") || "0", 10);
    const MIN_AUDIO_SIZE = 10 * 1024; // 10KB minimum

    if (contentLength < MIN_AUDIO_SIZE) {
      console.log("[transcribe] Audio file too small:", { sessionId, contentLength });
      return NextResponse.json(
        {
          error: "ההקלטה קצרה מדי לתמלול. יש להקליט לפחות 10 שניות של דיבור.",
          code: "AUDIO_TOO_SHORT",
          details: { fileSize: contentLength, minRequired: MIN_AUDIO_SIZE },
        },
        { status: 400 }
      );
    }
  } catch (sizeCheckError) {
    console.warn("[transcribe] Could not check audio file size:", sizeCheckError);
    // Continue anyway - let the transcription service handle it
  }

  // Check if already processing or completed
  if (session.status === "processing") {
    return NextResponse.json({ error: "Transcription already in progress" }, { status: 409 });
  }

  if (session.status === "completed") {
    return NextResponse.json({ error: "Session already transcribed" }, { status: 409 });
  }

  // Update status to processing
  await supabase
    .from("sessions")
    .update({ status: "processing" })
    .eq("id", sessionId);

  try {
    // Get transcription service
    const transcriptionService = getTranscriptionService();

    // Use session's detected_language if set, otherwise auto-detect
    let detectedLanguage = session.detected_language;

    if (!detectedLanguage) {
      console.log("[transcribe] No language set, auto-detecting...");

      // Fetch audio for language detection
      // Use HEAD first to check file size for optimization
      const headResponse = await fetch(session.audio_url, { method: "HEAD" });
      const contentLength = parseInt(headResponse.headers.get("content-length") || "0", 10);

      // For language detection, we only need first ~10 seconds (~160KB at 128kbps)
      // Use Range header to fetch only what we need
      const sampleSize = Math.min(contentLength, 160000);

      const audioResponse = await fetch(session.audio_url, {
        headers: sampleSize < contentLength ? { Range: `bytes=0-${sampleSize - 1}` } : {},
      });

      if (!audioResponse.ok) {
        console.warn("[transcribe] Failed to fetch audio for detection, defaulting to Hebrew");
        detectedLanguage = "he";
      } else {
        const audioBlob = await audioResponse.blob();
        detectedLanguage = await transcriptionService.detectLanguage(audioBlob);
        console.log("[transcribe] Auto-detected language:", detectedLanguage);
      }

      // Save detected language to session
      await supabase
        .from("sessions")
        .update({ detected_language: detectedLanguage })
        .eq("id", sessionId);
    }

    console.log("[transcribe] Starting transcription:", {
      sessionId,
      audioUrl: session.audio_url,
      detectedLanguage,
    });

    // For Hebrew: Use async job submission (Ivrit AI via RunPod)
    // For English: Use sync Whisper (fast enough for Vercel timeout)
    if (detectedLanguage === "he") {
      console.log("[transcribe] Submitting async job to Ivrit AI...");

      // Submit async job to Ivrit AI using URL (avoids 10MB body limit)
      // The audio_url is already a public URL from Supabase Storage
      const { jobId } = await transcriptionService.submitAsyncJob(session.audio_url, {
        numSpeakers: 10,
        prompt: session.context || undefined,
      });

      console.log("[transcribe] Job submitted successfully:", { jobId });

      // Save job ID and detected language to session
      const { error: updateError } = await supabase
        .from("sessions")
        .update({
          transcription_job_id: jobId,
          detected_language: detectedLanguage,
        })
        .eq("id", sessionId);

      if (updateError) {
        console.error("[transcribe] Failed to save job ID:", updateError);
        throw new Error(`Failed to save job ID: ${updateError.message}`);
      }

      console.log("[transcribe] Job ID saved to session");

      return NextResponse.json({
        success: true,
        async: true,
        jobId,
        message: "Transcription job submitted. Poll /transcription-status for updates.",
      });
    }

    // For English: Use sync Whisper (completes quickly)
    // Need to fetch the audio blob for Whisper (OpenAI API requires file upload)
    const audioResponse = await fetch(session.audio_url);
    if (!audioResponse.ok) {
      throw new Error("Failed to fetch audio file");
    }
    const audioBlob = await audioResponse.blob();

    const result = await transcriptionService.transcribe(audioBlob, {
      numSpeakers: 10,
      prompt: session.context || undefined,
      language: "en",
    });

    // Save transcript to database
    const { data: transcript, error: transcriptError } = await supabase
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

    // Save transcript segments
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
        detected_language: detectedLanguage,
        duration_seconds: result.duration,
        participant_count: uniqueSpeakers,
      })
      .eq("id", sessionId);

    // Now run optional AI enhancements - these can fail without breaking the flow
    // Run deep refinement
    try {
      const { data: dbSegments } = await supabase
        .from("transcript_segments")
        .select("speaker_name, text, start_time, segment_order")
        .eq("transcript_id", transcript.id)
        .order("segment_order");

      if (dbSegments && dbSegments.length > 0) {
        const refinementResult = await deepRefineTranscript(dbSegments, {
          meetingContext: session.context || undefined,
          language: "en",
        });

        const { modifiedCount, deletedCount } = await applyDeepRefinements(
          supabase,
          transcript.id,
          refinementResult
        );

        console.log(`[transcribe] Deep refinement: ${modifiedCount} modified, ${deletedCount} deleted`);
      }
    } catch (refinementError) {
      console.error("[transcribe] Deep refinement failed:", refinementError);
    }

    // Auto-generate summary
    try {
      await generateAndSaveSummary(supabase, sessionId, user.id, {
        context: session.context || undefined,
        language: "en",
        transcriptId: transcript.id,
      });
      console.log(`[transcribe] Auto-summary generated for session ${sessionId}`);
    } catch (summaryError) {
      console.error("[transcribe] Auto-summary failed:", summaryError);
    }

    // Auto-generate embeddings for memory chat
    try {
      const { data: finalSegments } = await supabase
        .from("transcript_segments")
        .select("speaker_id, speaker_name, text, start_time, end_time, segment_order")
        .eq("transcript_id", transcript.id)
        .is("is_deleted", false)
        .order("segment_order");

      if (finalSegments && finalSegments.length > 0) {
        // Delete any existing embeddings for this session
        await supabase.from("memory_embeddings").delete().eq("session_id", sessionId);

        // Chunk transcript for embedding
        const dedupedSegments = dedupeSegmentsByTimeAndText(finalSegments);
        const segments = dedupedSegments.map((seg) => ({
          speakerId: seg.speaker_id,
          speakerName: seg.speaker_name,
          text: seg.text,
          startTime: seg.start_time,
        }));

        const chunks = chunkTranscriptForEmbedding(segments);

        if (chunks.length > 0) {
          const embeddings = await generateEmbeddings(chunks.map((c) => c.text));

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
            console.error("[transcribe] Failed to save embeddings:", embeddingError);
          } else {
            console.log(`[transcribe] Auto-embeddings generated: ${chunks.length} chunks`);
          }
        }
      }
    } catch (embeddingError) {
      console.error("[transcribe] Auto-embedding failed:", embeddingError);
    }

    // Auto-extract entities from transcript
    try {
      const entitySegments = result.segments.map((seg) => ({
        speaker: seg.speaker,
        text: seg.text,
      }));

      const entityResult = await extractEntities(entitySegments, "en");

      let extractedCount = 0;
      for (const entity of entityResult.entities) {
        const { data: existingEntity } = await supabase
          .from("entities")
          .select("id, mention_count")
          .eq("user_id", user.id)
          .eq("type", entity.type)
          .eq("normalized_value", entity.normalizedValue.toLowerCase())
          .single();

        let entityId: string;

        if (existingEntity) {
          entityId = existingEntity.id;
          await supabase
            .from("entities")
            .update({
              mention_count: existingEntity.mention_count + entity.mentions,
            })
            .eq("id", entityId);
        } else {
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
            console.error("[transcribe] Failed to create entity:", createError);
            continue;
          }
          entityId = newEntity.id;
        }

        // Sync entity to Neo4j
        if (!isValidEntityType(entity.type)) {
          console.warn(`[transcribe] Invalid entity type: ${entity.type}, skipping Neo4j sync`);
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
            console.error("[transcribe] Failed to sync entity to Neo4j:", neo4jError);
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

      console.log(`[transcribe] Auto-entities extracted: ${extractedCount} for session ${sessionId}`);

      // Auto-extract relationships between entities (only if we have enough entities)
      if (extractedCount >= 2) {
        try {
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
            const formattedTranscript = result.segments
              .map((seg) => `${seg.speaker}: ${seg.text}`)
              .join("\n");

            const relResult = await extractRelationships(
              formattedTranscript,
              entities,
              "en"
            );

            const CONFIDENCE_THRESHOLD = 0.7;
            let relSavedCount = 0;

            for (const rel of relResult.relationships) {
              if (!isValidRelationshipType(rel.relationshipType)) {
                continue;
              }

              const confidence = rel.confidence ?? 0.8;
              // Sanitize relationship type to prevent Cypher injection
              const safeRelType = sanitizeNeo4jLabel(rel.relationshipType);

              if (confidence >= CONFIDENCE_THRESHOLD) {
                try {
                  await runSingleQuery(
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
                  relSavedCount++;
                } catch (relCreateError) {
                  console.error("[transcribe] Failed to create relationship:", relCreateError);
                }
              } else {
                // Low confidence - save as suggestion
                try {
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
                } catch (suggestionError) {
                  console.error("[transcribe] Failed to save relationship suggestion:", suggestionError);
                }
              }
            }

            console.log(`[transcribe] Auto-relationships: ${relSavedCount} created for session ${sessionId}`);
          }
        } catch (relError) {
          console.error("[transcribe] Auto-relationship extraction failed:", relError);
        }
      }
    } catch (entityError) {
      console.error("[transcribe] Auto-entity extraction failed:", entityError);
    }

    return NextResponse.json({
      success: true,
      async: false,
      transcript: {
        id: transcript.id,
        language: result.language,
        segmentCount: result.segments.length,
        duration: result.duration,
      },
    });
  } catch (error) {
    // Detailed error logging for debugging
    console.error("Transcription failed:", {
      sessionId,
      audioUrl: session.audio_url,
      detectedLanguage: session.detected_language || "he",
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update session status to failed
    await supabase
      .from("sessions")
      .update({ status: "failed" })
      .eq("id", sessionId);

    const errorMessage = error instanceof Error ? error.message : "Transcription failed";
    return NextResponse.json(
      {
        error: errorMessage,
        code: "TRANSCRIPTION_ERROR",
        sessionId,
      },
      { status: 500 }
    );
  }
}
