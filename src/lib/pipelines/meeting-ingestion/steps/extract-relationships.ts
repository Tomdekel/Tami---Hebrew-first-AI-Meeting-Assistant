/**
 * Relationship Extraction Step
 *
 * Extracts relationships between entities:
 * - Identifies connections between persons, orgs, projects, etc.
 * - High-confidence relationships → Neo4j
 * - Low-confidence relationships → suggestions table for review
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { extractRelationships, isValidRelationshipType } from "@/lib/ai/relationships";
import { runSingleQuery } from "@/lib/neo4j/client";
import type { PipelineState, StepResult } from "../types";

const CONFIDENCE_THRESHOLD = 0.7;

function sanitizeNeo4jLabel(label: string): string {
  return label.replace(/[^a-zA-Z0-9_]/g, "_");
}

interface ExtractRelationshipsResult {
  createdCount: number;
  suggestionsCount: number;
}

export async function extractRelationshipsStep(
  state: PipelineState,
  supabase: SupabaseClient
): Promise<StepResult<ExtractRelationshipsResult>> {
  if (!state.transcriptionResult?.segments || state.transcriptionResult.segments.length < 2) {
    return {
      success: true,
      data: { createdCount: 0, suggestionsCount: 0 },
    };
  }

  try {
    // Get entities for this session
    const { data: entityMentions } = await supabase
      .from("entity_mentions")
      .select(
        `
        entities (
          type,
          value,
          normalized_value
        )
      `
      )
      .eq("session_id", state.sessionId);

    const entities = (entityMentions || [])
      .map((m) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entity = m.entities as any;
        if (!entity) return null;
        return {
          type: entity.type,
          value: entity.value,
          normalizedValue: entity.normalized_value,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (entities.length < 2) {
      console.log("[pipeline:extract-relationships] Not enough entities for relationships");
      return {
        success: true,
        data: { createdCount: 0, suggestionsCount: 0 },
      };
    }

    console.log("[pipeline:extract-relationships] Starting relationship extraction...");

    // Format transcript for relationship extraction
    const formattedTranscript = state.transcriptionResult.segments
      .map((seg) => `${seg.speaker}: ${seg.text}`)
      .join("\n");

    const relResult = await extractRelationships(formattedTranscript, entities, state.language);

    let createdCount = 0;
    let suggestionsCount = 0;

    for (const rel of relResult.relationships) {
      if (!isValidRelationshipType(rel.relationshipType)) {
        continue;
      }

      const confidence = rel.confidence ?? 0.8;
      const safeRelType = sanitizeNeo4jLabel(rel.relationshipType);

      if (confidence >= CONFIDENCE_THRESHOLD) {
        // High confidence - create in Neo4j
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
              userId: state.userId,
              sourceNormalized: rel.sourceValue.toLowerCase(),
              sourceValue: rel.sourceValue,
              targetNormalized: rel.targetValue.toLowerCase(),
              targetValue: rel.targetValue,
              confidence,
              context: rel.context,
              sessionId: state.sessionId,
            }
          );
          createdCount++;
        } catch (relCreateError) {
          console.error("[pipeline:extract-relationships] Failed to create:", relCreateError);
        }
      } else {
        // Low confidence - save as suggestion
        try {
          const { data: sourceEntity } = await supabase
            .from("entities")
            .select("id")
            .eq("user_id", state.userId)
            .ilike("normalized_value", rel.sourceValue.toLowerCase())
            .single();

          const { data: targetEntity } = await supabase
            .from("entities")
            .select("id")
            .eq("user_id", state.userId)
            .ilike("normalized_value", rel.targetValue.toLowerCase())
            .single();

          await supabase.from("relationship_suggestions").insert({
            user_id: state.userId,
            session_id: state.sessionId,
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
          suggestionsCount++;
        } catch (suggestionError) {
          console.error("[pipeline:extract-relationships] Failed to save suggestion:", suggestionError);
        }
      }
    }

    console.log("[pipeline:extract-relationships] Completed:", { createdCount, suggestionsCount });

    return {
      success: true,
      data: { createdCount, suggestionsCount },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Relationship extraction failed";
    console.error("[pipeline:extract-relationships] Error:", message);

    // Relationship extraction is optional
    return {
      success: true,
      data: { createdCount: 0, suggestionsCount: 0 },
    };
  }
}
