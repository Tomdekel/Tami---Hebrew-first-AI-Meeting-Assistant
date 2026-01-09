/**
 * Duplicate Detection API
 *
 * GET /api/graph/entities/duplicates - Find all duplicate entity groups
 *
 * Returns groups of entities that are likely duplicates, with the most
 * mentioned entity as the "canonical" entity in each group.
 *
 * Query params:
 * - threshold: Minimum similarity score (0-1, default: 0.7)
 * - type: Filter to specific entity type (optional)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runQuery } from "@/lib/neo4j/client";
import { GraphEntity } from "@/lib/neo4j/types";
import { findDuplicateGroups } from "@/lib/ai/entity-similarity";

// Valid entity types to prevent Cypher injection
const VALID_ENTITY_TYPES = [
  "person",
  "organization",
  "project",
  "topic",
  "technology",
  "product",
  "location",
  "date",
  "other",
];

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  // Validate threshold parameter
  const thresholdParam = parseFloat(searchParams.get("threshold") || "0.7");
  if (isNaN(thresholdParam)) {
    return NextResponse.json({ error: "Invalid threshold parameter" }, { status: 400 });
  }
  const threshold = Math.max(0, Math.min(1, thresholdParam));

  const typeFilter = searchParams.get("type");

  // Validate type filter against whitelist to prevent Cypher injection
  if (typeFilter && !VALID_ENTITY_TYPES.includes(typeFilter.toLowerCase())) {
    return NextResponse.json({ error: "Invalid entity type" }, { status: 400 });
  }

  try {
    // Get all entities for this user (limited to prevent memory issues)
    let query = `
      MATCH (e:Entity {user_id: $userId})
      RETURN e as entity, labels(e) as types
      ORDER BY e.mention_count DESC
      LIMIT 500
    `;

    if (typeFilter) {
      const capitalizedType = typeFilter.charAt(0).toUpperCase() + typeFilter.slice(1).toLowerCase();
      query = `
        MATCH (e:Entity:${capitalizedType} {user_id: $userId})
        RETURN e as entity, labels(e) as types
        ORDER BY e.mention_count DESC
        LIMIT 500
      `;
    }

    const entitiesResult = await runQuery<{
      entity: GraphEntity;
      types: string[];
    }>(query, { userId: user.id });

    // Add labels to entities
    const entities = entitiesResult.map((r) => ({
      ...r.entity,
      _labels: r.types,
    }));

    // Find duplicate groups
    const groups = await findDuplicateGroups(entities, {
      threshold,
    });

    // Format response
    const formattedGroups = groups.map((group) => {
      const canonicalType =
        group.canonical._labels?.find((t) => t !== "Entity")?.toLowerCase() ||
        "other";

      return {
        canonical: {
          id: group.canonical.id,
          displayValue: group.canonical.display_value,
          normalizedValue: group.canonical.normalized_value,
          type: canonicalType,
          mentionCount: group.canonical.mention_count,
          aliases: group.canonical.aliases || [],
        },
        duplicates: group.duplicates.map((d) => {
          const dupType =
            d.entity._labels?.find((t) => t !== "Entity")?.toLowerCase() ||
            "other";

          return {
            id: d.entity.id,
            displayValue: d.entity.display_value,
            normalizedValue: d.entity.normalized_value,
            type: dupType,
            mentionCount: d.entity.mention_count,
            aliases: d.entity.aliases || [],
            similarity: {
              score: d.score,
              method: d.method,
              reason: d.reason,
            },
          };
        }),
        totalDuplicates: group.duplicates.length,
      };
    });

    // Calculate summary stats
    const totalGroups = formattedGroups.length;
    const totalDuplicates = formattedGroups.reduce(
      (sum, g) => sum + g.duplicates.length,
      0
    );
    const entitiesAffected = totalGroups + totalDuplicates;

    return NextResponse.json({
      groups: formattedGroups,
      summary: {
        totalGroups,
        totalDuplicates,
        entitiesAffected,
        totalEntities: entities.length,
        duplicatePercentage:
          entities.length > 0
            ? Math.round((entitiesAffected / entities.length) * 100)
            : 0,
      },
    });
  } catch (error) {
    console.error("Error finding duplicates:", error);
    return NextResponse.json(
      { error: "Failed to find duplicates" },
      { status: 500 }
    );
  }
}
