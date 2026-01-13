/**
 * Entity Extraction Step
 *
 * Extracts named entities from transcript:
 * - Persons
 * - Organizations
 * - Projects
 * - Topics
 * - Locations
 * - Dates
 * - Products
 * - Technologies
 *
 * Syncs entities to both Supabase and Neo4j.
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { extractEntities, EntityType } from "@/lib/ai/entities";
import { runSingleQuery } from "@/lib/neo4j/client";
import type { PipelineState, StepResult } from "../types";

const VALID_ENTITY_TYPES: readonly string[] = [
  "person",
  "organization",
  "project",
  "topic",
  "location",
  "date",
  "product",
  "technology",
  "other",
];

function isValidEntityType(type: string): type is EntityType {
  return VALID_ENTITY_TYPES.includes(type);
}

function sanitizeNeo4jLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, "_");
}

interface ExtractEntitiesResult {
  extractedCount: number;
}

export async function extractEntitiesStep(
  state: PipelineState,
  supabase: SupabaseClient
): Promise<StepResult<ExtractEntitiesResult>> {
  if (!state.transcriptionResult?.segments || state.transcriptionResult.segments.length === 0) {
    return {
      success: true,
      data: { extractedCount: 0 },
    };
  }

  try {
    console.log("[pipeline:extract-entities] Starting entity extraction...");

    const entitySegments = state.transcriptionResult.segments.map((seg) => ({
      speaker: seg.speaker,
      text: seg.text,
    }));

    const entityResult = await extractEntities(entitySegments, state.language);

    let extractedCount = 0;

    for (const entity of entityResult.entities) {
      // Check if entity already exists
      const { data: existingEntity } = await supabase
        .from("entities")
        .select("id, mention_count")
        .eq("user_id", state.userId)
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
            user_id: state.userId,
            type: entity.type,
            value: entity.value,
            normalized_value: entity.normalizedValue.toLowerCase(),
            mention_count: entity.mentions,
          })
          .select("id")
          .single();

        if (createError) {
          console.error("[pipeline:extract-entities] Failed to create entity:", createError);
          continue;
        }
        entityId = newEntity.id;
      }

      // Sync entity to Neo4j
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
              userId: state.userId,
              entityId,
              normalizedValue: entity.normalizedValue.toLowerCase(),
              displayValue: entity.value,
              mentions: entity.mentions,
              now,
            }
          );
        } catch (neo4jError) {
          console.error("[pipeline:extract-entities] Failed to sync to Neo4j:", neo4jError);
        }
      }

      // Create entity mention for this session
      await supabase.from("entity_mentions").insert({
        entity_id: entityId,
        session_id: state.sessionId,
        context: entity.context,
      });

      extractedCount++;
    }

    console.log("[pipeline:extract-entities] Extracted:", { extractedCount });

    return {
      success: true,
      data: { extractedCount },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Entity extraction failed";
    console.error("[pipeline:extract-entities] Error:", message);

    // Entity extraction is optional
    return {
      success: true,
      data: { extractedCount: 0 },
    };
  }
}
