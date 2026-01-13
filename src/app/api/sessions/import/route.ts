import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { unauthorized, badRequest, internalError } from "@/lib/api/errors";
import {
  parseTranscript,
  isSupportedTranscriptFormat,
  determineSourceType,
  SUPPORTED_TRANSCRIPT_EXTENSIONS,
} from "@/lib/parsers";
import { generateAndSaveSummary } from "@/lib/ai";
import { generateEmbeddings, chunkTranscriptForEmbedding } from "@/lib/ai/embeddings";
import { extractEntities, EntityType } from "@/lib/ai/entities";
import { extractRelationships, isValidRelationshipType } from "@/lib/ai/relationships";
import { runSingleQuery } from "@/lib/neo4j/client";
import type { SourceType, IngestionConfidence, ExternalFormat } from "@/lib/types/database";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Valid entity types - must match EntityType from entities.ts
const VALID_ENTITY_TYPES: readonly string[] = [
  "person", "organization", "project", "topic",
  "location", "date", "product", "technology", "other"
];

function isValidEntityType(type: string): type is EntityType {
  return VALID_ENTITY_TYPES.includes(type);
}

function sanitizeNeo4jLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, '_');
}

interface ImportTranscriptResponse {
  success: boolean;
  sessionId: string;
  status: string;
  sourceType: SourceType;
  confidence: IngestionConfidence;
  segmentCount: number;
  speakerCount: number;
}

// POST /api/sessions/import - Import a transcript file
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return unauthorized();
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string | null;
    const context = formData.get("context") as string | null;
    const meetingDate = formData.get("date") as string | null;

    if (!file) {
      return badRequest("File is required");
    }

    // Validate file type
    if (!isSupportedTranscriptFormat(file.name, file.type)) {
      return badRequest(
        `Unsupported file type. Supported formats: ${SUPPORTED_TRANSCRIPT_EXTENSIONS.join(", ")}`
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return badRequest(`File size exceeds maximum allowed (${MAX_FILE_SIZE / 1024 / 1024}MB)`);
    }

    // Read file content
    let buffer: Buffer;
    try {
      buffer = Buffer.from(await file.arrayBuffer());
      console.log("[import] File read successfully:", { size: buffer.length, filename: file.name });
    } catch (readError) {
      console.error("[import] Failed to read file:", readError);
      return internalError(`Failed to read file: ${readError instanceof Error ? readError.message : 'Unknown error'}`);
    }

    // Parse the transcript
    let parsed: Awaited<ReturnType<typeof parseTranscript>>;
    try {
      parsed = await parseTranscript(buffer, file.name, {}, file.type);
      console.log("[import] Transcript parsed:", {
        segments: parsed.segments.length,
        speakers: parsed.speakerNames.length,
        confidence: parsed.confidence,
        format: parsed.format,
      });
    } catch (parseError) {
      console.error("[import] Failed to parse transcript:", parseError);
      return internalError(`Failed to parse transcript: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Determine source type
    const sourceType = determineSourceType(parsed);

    // Detect language from content (simple heuristic)
    const hebrewPattern = /[\u0590-\u05FF]/;
    const detectedLanguage = hebrewPattern.test(parsed.fullText) ? "he" : "en";

    // Create session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        title: title || file.name.replace(/\.[^.]+$/, ""), // Use filename without extension as default
        context: context || null,
        status: "processing",
        audio_url: null, // No audio for imported transcripts
        detected_language: detectedLanguage,
        duration_seconds: null,
        source_type: sourceType,
        source_metadata: {
          original_filename: file.name,
          file_size: file.size,
          mime_type: file.type,
          import_date: new Date().toISOString(),
          meeting_date: meetingDate || null,
        },
        has_timestamps: parsed.hasTimestamps,
        ingestion_confidence: parsed.confidence,
      })
      .select()
      .single();

    if (sessionError || !session) {
      console.error("Failed to create session:", sessionError);
      return internalError("Failed to create session", { dbError: sessionError?.message });
    }

    // Create transcript
    const { data: transcript, error: transcriptError } = await supabase
      .from("transcripts")
      .insert({
        session_id: session.id,
        language: detectedLanguage,
        full_text: parsed.fullText,
        origin: "imported",
        external_format: parsed.format as ExternalFormat,
      })
      .select()
      .single();

    if (transcriptError || !transcript) {
      console.error("Failed to create transcript:", transcriptError);
      // Clean up session
      await supabase.from("sessions").delete().eq("id", session.id);
      return internalError("Failed to create transcript", { dbError: transcriptError?.message });
    }

    // Create transcript segments
    if (parsed.segments.length > 0) {
      const segments = parsed.segments.map((seg, index) => ({
        transcript_id: transcript.id,
        speaker_id: seg.speaker?.toLowerCase().replace(/\s+/g, "_") || `speaker_${index + 1}`,
        speaker_name: seg.speaker || `Speaker ${index + 1}`,
        text: seg.text,
        start_time: seg.startTime ?? 0,
        end_time: seg.endTime ?? 0,
        segment_order: index,
      }));

      const { error: segmentsError } = await supabase
        .from("transcript_segments")
        .insert(segments);

      if (segmentsError) {
        console.error("Failed to create segments:", segmentsError);
        // Continue anyway - we have the full_text
      }
    }

    // Update session to completed status before running AI enhancements
    // This ensures the session is usable even if AI processing fails
    await supabase
      .from("sessions")
      .update({
        status: "completed",
        participant_count: parsed.speakerNames.length || 1,
      })
      .eq("id", session.id);

    // Run AI enhancements in the background (non-blocking)
    // These can fail without breaking the import flow
    runAIEnhancements(supabase, session.id, transcript.id, user.id, parsed, detectedLanguage).catch(
      (error) => console.error("[import] AI enhancements failed:", error)
    );

    const response: ImportTranscriptResponse = {
      success: true,
      sessionId: session.id,
      status: "completed",
      sourceType,
      confidence: parsed.confidence,
      segmentCount: parsed.segments.length,
      speakerCount: parsed.speakerNames.length || 1,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    // Detailed error logging for debugging
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[import] Import failed:", {
      error: errorMessage,
      stack: errorStack,
    });

    // Always return detailed error message for import failures
    // This helps users understand what went wrong
    return internalError(errorMessage || "Failed to import transcript", {
      timestamp: new Date().toISOString(),
    });
  }
}

// Run AI enhancements (summary, embeddings, entities, relationships)
async function runAIEnhancements(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionId: string,
  transcriptId: string,
  userId: string,
  parsed: Awaited<ReturnType<typeof parseTranscript>>,
  language: string
) {
  console.log(`[import] Running AI enhancements for session ${sessionId}`);

  // Generate summary
  try {
    await generateAndSaveSummary(supabase, sessionId, userId, {
      language,
      transcriptId,
    });
    console.log(`[import] Summary generated for session ${sessionId}`);
  } catch (summaryError) {
    console.error("[import] Summary generation failed:", summaryError);
  }

  // Generate embeddings
  try {
    // Delete any existing embeddings
    await supabase.from("memory_embeddings").delete().eq("session_id", sessionId);

    // Prepare segments for embedding
    const segments = parsed.segments.map((seg, index) => ({
      speakerId: seg.speaker?.toLowerCase().replace(/\s+/g, "_") || `speaker_${index + 1}`,
      speakerName: seg.speaker || `Speaker ${index + 1}`,
      text: seg.text,
      startTime: seg.startTime ?? 0,
    }));

    const chunks = chunkTranscriptForEmbedding(segments);

    if (chunks.length > 0) {
      const embeddings = await generateEmbeddings(chunks.map((c) => c.text));

      const embeddingRecords = chunks.map((chunk, i) => ({
        user_id: userId,
        session_id: sessionId,
        content: chunk.text,
        embedding: `[${embeddings[i].embedding.join(",")}]`,
        metadata: {
          speakerName: chunk.speakerName,
          startTime: chunk.startTime,
          segmentIndices: chunk.segmentIndices,
        },
      }));

      await supabase.from("memory_embeddings").insert(embeddingRecords);
      console.log(`[import] Embeddings generated: ${chunks.length} chunks for session ${sessionId}`);
    }
  } catch (embeddingError) {
    console.error("[import] Embedding generation failed:", embeddingError);
  }

  // Extract entities
  try {
    const entitySegments = parsed.segments.map((seg) => ({
      speaker: seg.speaker || "Unknown",
      text: seg.text,
    }));

    const entityResult = await extractEntities(entitySegments, language);

    let extractedCount = 0;
    for (const entity of entityResult.entities) {
      const { data: existingEntity } = await supabase
        .from("entities")
        .select("id, mention_count")
        .eq("user_id", userId)
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
            user_id: userId,
            type: entity.type,
            value: entity.value,
            normalized_value: entity.normalizedValue.toLowerCase(),
            mention_count: entity.mentions,
          })
          .select("id")
          .single();

        if (createError) {
          console.error("[import] Failed to create entity:", createError);
          continue;
        }
        entityId = newEntity.id;
      }

      // Sync to Neo4j
      if (isValidEntityType(entity.type)) {
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
              userId,
              entityId,
              normalizedValue: entity.normalizedValue.toLowerCase(),
              displayValue: entity.value,
              mentions: entity.mentions,
              now,
            }
          );
        } catch (neo4jError) {
          console.error("[import] Neo4j sync failed:", neo4jError);
        }
      }

      // Create entity mention
      await supabase.from("entity_mentions").insert({
        entity_id: entityId,
        session_id: sessionId,
        context: entity.context,
      });

      extractedCount++;
    }

    console.log(`[import] Entities extracted: ${extractedCount} for session ${sessionId}`);

    // Extract relationships if we have enough entities
    if (extractedCount >= 2) {
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
        const formattedTranscript = parsed.segments
          .map((seg) => `${seg.speaker || "Unknown"}: ${seg.text}`)
          .join("\n");

        const relResult = await extractRelationships(
          formattedTranscript,
          entities,
          language
        );

        const CONFIDENCE_THRESHOLD = 0.7;
        let relSavedCount = 0;

        for (const rel of relResult.relationships) {
          if (!isValidRelationshipType(rel.relationshipType)) {
            continue;
          }

          const confidence = rel.confidence ?? 0.8;
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
                  userId,
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
              console.error("[import] Failed to create relationship:", relCreateError);
            }
          } else {
            // Save as suggestion
            try {
              const { data: sourceEntity } = await supabase
                .from("entities")
                .select("id")
                .eq("user_id", userId)
                .ilike("normalized_value", rel.sourceValue.toLowerCase())
                .single();

              const { data: targetEntity } = await supabase
                .from("entities")
                .select("id")
                .eq("user_id", userId)
                .ilike("normalized_value", rel.targetValue.toLowerCase())
                .single();

              await supabase
                .from("relationship_suggestions")
                .insert({
                  user_id: userId,
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
              console.error("[import] Failed to save relationship suggestion:", suggestionError);
            }
          }
        }

        console.log(`[import] Relationships created: ${relSavedCount} for session ${sessionId}`);
      }
    }
  } catch (entityError) {
    console.error("[import] Entity extraction failed:", entityError);
  }
}
