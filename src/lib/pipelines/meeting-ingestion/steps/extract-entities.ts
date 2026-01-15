/**
 * Entity Extraction Step
 *
 * Extracts named entities from transcript using LangExtract:
 * - Persons
 * - Organizations
 * - Projects
 * - Topics
 * - Locations
 * - Dates
 * - Products
 * - Technologies
 *
 * Features:
 * - Source grounding (character offsets)
 * - Confidence scores
 * - Cross-type deduplication
 *
 * Syncs entities to both Supabase and Neo4j.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  extractEntitiesWithGrounding,
  checkLangExtractHealth,
  GroundedEntity,
  EntityType,
} from "@/lib/ai/langextract-client";
import { extractEntities as extractEntitiesLegacy } from "@/lib/ai/entities";
import { runSingleQuery } from "@/lib/neo4j/client";
import type { PipelineState, StepResult } from "../types";

// Whitelist of valid entity types - used for Neo4j label generation
const VALID_ENTITY_TYPES = new Set([
  "person",
  "organization",
  "project",
  "topic",
  "location",
  "date",
  "product",
  "technology",
  "other",
]);

function isValidEntityType(type: string): type is EntityType {
  return VALID_ENTITY_TYPES.has(type);
}

/**
 * Get safe Neo4j label from entity type.
 * Uses whitelist to prevent label injection attacks.
 */
function getNeo4jLabel(type: string): string {
  if (!VALID_ENTITY_TYPES.has(type)) {
    return "Entity"; // Default safe label for unknown types
  }
  // Capitalize first letter for Neo4j convention
  return type.charAt(0).toUpperCase() + type.slice(1);
}

interface ExtractEntitiesResult {
  extractedCount: number;
  usedLangExtract: boolean;
}

export async function extractEntitiesStep(
  state: PipelineState,
  supabase: SupabaseClient
): Promise<StepResult<ExtractEntitiesResult>> {
  try {
    console.log("[pipeline:extract-entities] Starting entity extraction...");

    // Get segments either from state (audio pipeline) or from database (import/enhancement pipeline)
    let entitySegments: { speaker: string; text: string }[] = [];

    if (
      state.transcriptionResult?.segments &&
      state.transcriptionResult.segments.length > 0
    ) {
      // Audio pipeline - segments in state
      entitySegments = state.transcriptionResult.segments.map((seg) => ({
        speaker: seg.speaker,
        text: seg.text,
      }));
    } else if (state.transcriptId) {
      // Enhancement/import pipeline - fetch segments from database
      const { data: dbSegments } = await supabase
        .from("transcript_segments")
        .select("speaker_name, speaker_id, text")
        .eq("transcript_id", state.transcriptId)
        .or("is_deleted.is.null,is_deleted.eq.false")
        .order("segment_order");

      if (dbSegments && dbSegments.length > 0) {
        entitySegments = dbSegments.map((seg) => ({
          speaker: seg.speaker_name || seg.speaker_id || "Unknown",
          text: seg.text,
        }));
      }
    }

    // Also include summary content for entity extraction (user may edit summaries with new info)
    if (state.sessionId) {
      const { data: summary } = await supabase
        .from("summaries")
        .select("overview, key_points, decisions, notes")
        .eq("session_id", state.sessionId)
        .single();

      if (summary) {
        if (summary.overview?.trim()) {
          entitySegments.push({ speaker: "Summary", text: summary.overview });
        }
        if (summary.key_points?.trim()) {
          entitySegments.push({
            speaker: "Key Points",
            text: summary.key_points,
          });
        }
        if (summary.decisions?.trim()) {
          entitySegments.push({ speaker: "Decisions", text: summary.decisions });
        }
        if (summary.notes?.trim()) {
          entitySegments.push({ speaker: "Notes", text: summary.notes });
        }
      }
    }

    if (entitySegments.length === 0) {
      console.log(
        "[pipeline:extract-entities] No segments or summary content to extract from"
      );
      return {
        success: true,
        data: { extractedCount: 0, usedLangExtract: false },
      };
    }

    console.log(
      "[pipeline:extract-entities] Processing",
      entitySegments.length,
      "segments (including summary)"
    );

    // Format transcript for extraction
    const transcript = entitySegments
      .map((s) => `${s.speaker}: ${s.text}`)
      .join("\n");

    // Check if LangExtract service is available
    const langExtractAvailable = await checkLangExtractHealth();
    let extractedCount = 0;
    let usedLangExtract = false;

    if (langExtractAvailable) {
      // Use LangExtract service
      console.log("[pipeline:extract-entities] Using LangExtract service");
      usedLangExtract = true;

      try {
        const result = await extractEntitiesWithGrounding(
          transcript,
          state.language
        );

        for (const entity of result.entities) {
          const savedEntity = await saveEntityWithGrounding(
            supabase,
            state,
            entity
          );
          if (savedEntity) {
            extractedCount++;
          }
        }
      } catch (langExtractError) {
        console.error(
          "[pipeline:extract-entities] LangExtract failed, falling back to legacy:",
          langExtractError
        );
        usedLangExtract = false;
      }
    }

    // Fallback to legacy extraction if LangExtract is unavailable or failed
    if (!usedLangExtract) {
      console.log(
        "[pipeline:extract-entities] Using legacy GPT extraction (LangExtract unavailable)"
      );

      const entityResult = await extractEntitiesLegacy(
        entitySegments,
        state.language
      );

      for (const entity of entityResult.entities) {
        const savedEntity = await saveEntityLegacy(supabase, state, entity);
        if (savedEntity) {
          extractedCount++;
        }
      }
    }

    console.log("[pipeline:extract-entities] Extracted:", {
      extractedCount,
      usedLangExtract,
    });

    return {
      success: true,
      data: { extractedCount, usedLangExtract },
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Entity extraction failed";
    console.error("[pipeline:extract-entities] Error:", message);

    // Entity extraction is optional
    return {
      success: true,
      data: { extractedCount: 0, usedLangExtract: false },
    };
  }
}

/**
 * Save entity with grounding information from LangExtract
 */
async function saveEntityWithGrounding(
  supabase: SupabaseClient,
  state: PipelineState,
  entity: GroundedEntity
): Promise<string | null> {
  try {
    // Use upsert for cross-type deduplication (unique on user_id + normalized_value)
    const { data: upsertedEntity, error: upsertError } = await supabase
      .from("entities")
      .upsert(
        {
          user_id: state.userId,
          type: entity.type,
          value: entity.value,
          normalized_value: entity.normalized_value,
          mention_count: 1,
        },
        {
          onConflict: "user_id,normalized_value",
          ignoreDuplicates: false,
        }
      )
      .select("id, mention_count")
      .single();

    if (upsertError) {
      // If upsert fails, try to find existing and update
      const { data: existingEntity } = await supabase
        .from("entities")
        .select("id, mention_count")
        .eq("user_id", state.userId)
        .eq("normalized_value", entity.normalized_value)
        .single();

      if (existingEntity) {
        await supabase
          .from("entities")
          .update({ mention_count: existingEntity.mention_count + 1 })
          .eq("id", existingEntity.id);

        // Store mention with grounding
        await supabase.from("entity_mentions").insert({
          entity_id: existingEntity.id,
          session_id: state.sessionId,
          context: entity.source_text,
          start_offset: entity.start_offset,
          end_offset: entity.end_offset,
          confidence: entity.confidence,
        });

        await syncToNeo4j(state, existingEntity.id, entity);
        return existingEntity.id;
      }

      console.error(
        "[pipeline:extract-entities] Failed to upsert entity:",
        upsertError
      );
      return null;
    }

    const entityId = upsertedEntity.id;

    // Store entity mention with grounding info
    await supabase.from("entity_mentions").insert({
      entity_id: entityId,
      session_id: state.sessionId,
      context: entity.source_text,
      start_offset: entity.start_offset,
      end_offset: entity.end_offset,
      confidence: entity.confidence,
    });

    // Sync to Neo4j with confidence
    await syncToNeo4j(state, entityId, entity);

    return entityId;
  } catch (error) {
    console.error(
      "[pipeline:extract-entities] Error saving entity with grounding:",
      error
    );
    return null;
  }
}

/**
 * Save entity using legacy format (backward compatibility)
 */
async function saveEntityLegacy(
  supabase: SupabaseClient,
  state: PipelineState,
  entity: {
    type: string;
    value: string;
    normalizedValue: string;
    mentions: number;
    context: string;
  }
): Promise<string | null> {
  try {
    // Check if entity already exists (cross-type lookup by normalized_value)
    const { data: existingEntity } = await supabase
      .from("entities")
      .select("id, mention_count")
      .eq("user_id", state.userId)
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
          user_id: state.userId,
          type: entity.type,
          value: entity.value,
          normalized_value: entity.normalizedValue.toLowerCase(),
          mention_count: entity.mentions,
        })
        .select("id")
        .single();

      if (createError) {
        console.error(
          "[pipeline:extract-entities] Failed to create entity:",
          createError
        );
        return null;
      }
      entityId = newEntity.id;
    }

    // Sync entity to Neo4j
    if (isValidEntityType(entity.type)) {
      const typeLabel = getNeo4jLabel(entity.type);
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
            userId: state.userId,
            entityId,
            normalizedValue: entity.normalizedValue.toLowerCase(),
            displayValue: entity.value,
            mentions: entity.mentions,
            now,
          }
        );
      } catch (neo4jError) {
        console.error(
          "[pipeline:extract-entities] Failed to sync to Neo4j:",
          neo4jError
        );
      }
    }

    // Create entity mention for this session
    await supabase.from("entity_mentions").insert({
      entity_id: entityId,
      session_id: state.sessionId,
      context: entity.context,
    });

    return entityId;
  } catch (error) {
    console.error(
      "[pipeline:extract-entities] Error saving legacy entity:",
      error
    );
    return null;
  }
}

/**
 * Sync entity to Neo4j with confidence score
 */
async function syncToNeo4j(
  state: PipelineState,
  entityId: string,
  entity: GroundedEntity
): Promise<void> {
  if (!isValidEntityType(entity.type)) return;

  const typeLabel = getNeo4jLabel(entity.type);
  const now = new Date().toISOString();

  try {
    await runSingleQuery(
      `
      MERGE (e:Entity:${typeLabel} {user_id: $userId, normalized_value: $normalizedValue})
      ON CREATE SET
        e.id = $entityId,
        e.display_value = $displayValue,
        e.mention_count = 1,
        e.confidence = $confidence,
        e.is_user_created = false,
        e.first_seen = datetime($now),
        e.last_seen = datetime($now),
        e.created_at = datetime($now)
      ON MATCH SET
        e.mention_count = e.mention_count + 1,
        e.confidence = CASE WHEN $confidence > e.confidence THEN $confidence ELSE e.confidence END,
        e.last_seen = datetime($now)
      `,
      {
        userId: state.userId,
        entityId,
        normalizedValue: entity.normalized_value,
        displayValue: entity.value,
        confidence: entity.confidence,
        now,
      }
    );
  } catch (neo4jError) {
    console.error(
      "[pipeline:extract-entities] Failed to sync to Neo4j:",
      neo4jError
    );
  }
}
