/**
 * Graph Entities API
 *
 * GET /api/graph/entities - List entities
 * POST /api/graph/entities - Create entity
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runQuery, runSingleQuery } from "@/lib/neo4j/client";
import { EntityType, GraphEntity } from "@/lib/neo4j/types";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") as EntityType | null;
  const search = searchParams.get("q");
  const limit = parseInt(searchParams.get("limit") || "100");

  try {
    let results: Record<string, unknown>[];

    if (search) {
      // Full-text search
      const typeFilter = type
        ? `AND node:${type.charAt(0).toUpperCase() + type.slice(1)}`
        : "";

      results = await runQuery(
        `
        CALL db.index.fulltext.queryNodes('entity_search', $search)
        YIELD node, score
        WHERE node.user_id = $userId ${typeFilter}
        RETURN node as entity, score, labels(node) as types
        ORDER BY score DESC
        LIMIT $limit
        `,
        { userId: user.id, search, limit }
      );
    } else {
      // List all entities
      const typeFilter = type
        ? `WHERE e:${type.charAt(0).toUpperCase() + type.slice(1)}`
        : "";

      results = await runQuery(
        `
        MATCH (e:Entity {user_id: $userId})
        ${typeFilter}
        OPTIONAL MATCH (e)-[:MENTIONED_IN]->(m:Meeting)
        WITH e, count(DISTINCT m) as meetingCount, labels(e) as types
        RETURN e as entity, meetingCount, types
        ORDER BY e.mention_count DESC
        LIMIT $limit
        `,
        { userId: user.id, limit }
      );
    }

    // Group by type
    const grouped: Record<string, unknown[]> = {};
    let total = 0;

    for (const r of results) {
      const types = (r.types as string[]) || [];
      const entityType =
        types.find((t) => t !== "Entity")?.toLowerCase() || "other";

      if (!grouped[entityType]) {
        grouped[entityType] = [];
      }

      grouped[entityType].push({
        ...(r.entity as Record<string, unknown>),
        meetingCount: r.meetingCount || 0,
        score: r.score,
      });
      total++;
    }

    // Get type counts
    const typeCounts: Record<string, number> = {};
    for (const [entityType, entities] of Object.entries(grouped)) {
      typeCounts[entityType] = entities.length;
    }

    return NextResponse.json({
      entities: grouped,
      totalEntities: total,
      typeCounts,
    });
  } catch (error) {
    console.error("Error fetching entities:", error);
    return NextResponse.json(
      { error: "Failed to fetch entities" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { type, value, description, aliases = [] } = body;

    if (!type || !value) {
      return NextResponse.json(
        { error: "Missing required fields: type, value" },
        { status: 400 }
      );
    }

    const label = type.charAt(0).toUpperCase() + type.slice(1);
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const result = await runSingleQuery<{ entity: GraphEntity }>(
      `
      CREATE (e:Entity:${label} {
        id: $id,
        user_id: $userId,
        normalized_value: $normalizedValue,
        display_value: $value,
        description: $description,
        aliases: $aliases,
        mention_count: 0,
        confidence: 1.0,
        is_user_created: true,
        first_seen: datetime($now),
        last_seen: datetime($now),
        created_at: datetime($now)
      })
      RETURN e as entity
      `,
      {
        id,
        userId: user.id,
        normalizedValue: value.toLowerCase(),
        value,
        description: description || null,
        aliases,
        now,
      }
    );

    if (!result) {
      return NextResponse.json(
        { error: "Failed to create entity" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      entity: {
        ...result.entity,
        type,
      },
    });
  } catch (error) {
    console.error("Error creating entity:", error);
    return NextResponse.json(
      { error: "Failed to create entity" },
      { status: 500 }
    );
  }
}
