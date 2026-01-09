/**
 * Graph Sync API
 *
 * POST /api/graph/sync - Sync entities from Supabase to Neo4j
 *
 * This is a utility endpoint to backfill existing entities into Neo4j
 * for users who had entities extracted before the Neo4j sync was added.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runSingleQuery } from "@/lib/neo4j/client";

// Valid entity types - must match EntityType from entities.ts
const VALID_ENTITY_TYPES: readonly string[] = [
  "person", "organization", "project", "topic",
  "location", "date", "product", "technology", "other"
];

function isValidEntityType(type: string): boolean {
  return VALID_ENTITY_TYPES.includes(type);
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all entities for this user from Supabase
    const { data: entities, error: fetchError } = await supabase
      .from("entities")
      .select("id, type, value, normalized_value, mention_count, created_at")
      .eq("user_id", user.id);

    if (fetchError) {
      throw new Error(`Failed to fetch entities: ${fetchError.message}`);
    }

    if (!entities || entities.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No entities to sync",
        synced: 0,
      });
    }

    // Sync each entity to Neo4j
    let syncedCount = 0;
    let failedCount = 0;

    for (const entity of entities) {
      // Validate entity type to prevent Cypher injection
      if (!isValidEntityType(entity.type)) {
        console.warn(`Invalid entity type: ${entity.type}, skipping`);
        failedCount++;
        continue;
      }

      const typeLabel = entity.type.charAt(0).toUpperCase() + entity.type.slice(1);
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
            e.first_seen = datetime($createdAt),
            e.last_seen = datetime($now),
            e.created_at = datetime($createdAt)
          ON MATCH SET
            e.id = $entityId,
            e.display_value = $displayValue,
            e.mention_count = $mentions,
            e.last_seen = datetime($now)
          `,
          {
            userId: user.id,
            entityId: entity.id,
            normalizedValue: entity.normalized_value,
            displayValue: entity.value,
            mentions: entity.mention_count || 1,
            createdAt: entity.created_at || now,
            now,
          }
        );
        syncedCount++;
      } catch (neo4jError) {
        console.error(`Failed to sync entity ${entity.id}:`, neo4jError);
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedCount} entities to Neo4j`,
      synced: syncedCount,
      failed: failedCount,
      total: entities.length,
    });
  } catch (error) {
    console.error("Sync failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
