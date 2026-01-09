/**
 * Similar Entities API
 *
 * GET /api/graph/entities/[id]/similar - Find entities similar to this one
 *
 * Query params:
 * - threshold: Minimum similarity score (0-1, default: 0.7)
 * - maxResults: Maximum matches to return (default: 5)
 * - skipLLM: Skip expensive LLM matching (default: false)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runQuery, runSingleQuery } from "@/lib/neo4j/client";
import { GraphEntity } from "@/lib/neo4j/types";
import { findSimilarEntities } from "@/lib/ai/entity-similarity";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);

  // Validate and clamp numeric parameters
  const thresholdParam = parseFloat(searchParams.get("threshold") || "0.7");
  const maxResultsParam = parseInt(searchParams.get("maxResults") || "5", 10);

  if (isNaN(thresholdParam) || isNaN(maxResultsParam)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const threshold = Math.max(0, Math.min(1, thresholdParam));
  const maxResults = Math.max(1, Math.min(100, maxResultsParam));
  const skipLLM = searchParams.get("skipLLM") === "true";

  try {
    // Get the source entity
    const sourceResult = await runSingleQuery<{
      entity: GraphEntity;
      types: string[];
    }>(
      `
      MATCH (e:Entity {id: $entityId, user_id: $userId})
      RETURN e as entity, labels(e) as types
      `,
      { entityId: id, userId: user.id }
    );

    if (!sourceResult) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const sourceEntity = sourceResult.entity;
    const sourceType =
      sourceResult.types.find((t) => t !== "Entity")?.toLowerCase() || "other";

    // Get all other entities of the same type
    const candidatesResult = await runQuery<{
      entity: GraphEntity;
      types: string[];
    }>(
      `
      MATCH (e:Entity {user_id: $userId})
      WHERE e.id <> $entityId
      RETURN e as entity, labels(e) as types
      ORDER BY e.mention_count DESC
      LIMIT 100
      `,
      { userId: user.id, entityId: id }
    );

    // Filter to same type and add _labels property
    const candidates = candidatesResult
      .map((r) => ({
        ...r.entity,
        _labels: r.types,
      }))
      .filter((c) => {
        const cType = c._labels?.find((t) => t !== "Entity")?.toLowerCase() || "other";
        return cType === sourceType;
      });

    // Find similar entities
    const matches = await findSimilarEntities(
      { ...sourceEntity, _labels: sourceResult.types },
      candidates,
      sourceType,
      {
        threshold,
        maxResults,
        skipLLM,
      }
    );

    // Format response
    const formattedMatches = matches.map((match) => {
      const matchType =
        match.entity._labels?.find((t) => t !== "Entity")?.toLowerCase() ||
        "other";

      return {
        id: match.entity.id,
        displayValue: match.entity.display_value,
        normalizedValue: match.entity.normalized_value,
        type: matchType,
        mentionCount: match.entity.mention_count,
        aliases: match.entity.aliases || [],
        similarity: {
          score: match.score,
          method: match.method,
          reason: match.reason,
        },
      };
    });

    return NextResponse.json({
      source: {
        id: sourceEntity.id,
        displayValue: sourceEntity.display_value,
        type: sourceType,
      },
      matches: formattedMatches,
      total: formattedMatches.length,
    });
  } catch (error) {
    console.error("Error finding similar entities:", error);
    return NextResponse.json(
      { error: "Failed to find similar entities" },
      { status: 500 }
    );
  }
}
