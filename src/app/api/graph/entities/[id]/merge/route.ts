/**
 * Entity Merge API
 *
 * POST /api/graph/entities/[id]/merge - Merge another entity into this one
 *
 * This endpoint merges the source entity (from request body) into the target entity (from URL).
 * The target entity is kept and updated with combined stats.
 * The source entity is deleted after transferring all relationships.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runSingleQuery } from "@/lib/neo4j/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: targetId } = await params;

  try {
    const body = await request.json();
    const { sourceId } = body;

    if (!sourceId) {
      return NextResponse.json(
        { error: "Missing required field: sourceId" },
        { status: 400 }
      );
    }

    if (sourceId === targetId) {
      return NextResponse.json(
        { error: "Cannot merge entity with itself" },
        { status: 400 }
      );
    }

    // Perform the merge operation:
    // 1. Transfer all MENTIONED_IN relationships
    // 2. Transfer all other outgoing relationships
    // 3. Transfer all incoming relationships
    // 4. Update target entity with combined stats and aliases
    // 5. Delete source entity
    const result = await runSingleQuery(
      `
      // Find both entities
      MATCH (target:Entity {id: $targetId, user_id: $userId})
      MATCH (source:Entity {id: $sourceId, user_id: $userId})

      // Transfer MENTIONED_IN relationships (merge mention counts)
      WITH target, source
      OPTIONAL MATCH (source)-[sm:MENTIONED_IN]->(m:Meeting)
      WITH target, source, collect({meeting: m, props: properties(sm)}) as sourceMentions
      FOREACH (mention IN sourceMentions |
        MERGE (target)-[tm:MENTIONED_IN]->(mention.meeting)
        ON CREATE SET
          tm.context = mention.props.context,
          tm.mention_count = mention.props.mention_count,
          tm.timestamp_start = mention.props.timestamp_start,
          tm.timestamp_end = mention.props.timestamp_end,
          tm.speaker = mention.props.speaker,
          tm.sentiment = mention.props.sentiment,
          tm.created_at = mention.props.created_at
        ON MATCH SET
          tm.mention_count = coalesce(tm.mention_count, 0) + coalesce(mention.props.mention_count, 1)
      )

      // Delete source's MENTIONED_IN relationships
      WITH target, source
      OPTIONAL MATCH (source)-[sm:MENTIONED_IN]->()
      DELETE sm

      // Transfer outgoing relationships (non-MENTIONED_IN)
      WITH target, source
      OPTIONAL MATCH (source)-[r]->(other)
      WHERE NOT other:Meeting AND type(r) <> 'MENTIONED_IN'
      WITH target, source, collect({other: other, type: type(r), props: properties(r)}) as outRels
      FOREACH (rel IN outRels |
        FOREACH (_ IN CASE WHEN rel.other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (target)-[newRel:RELATED_TO]->(rel.other)
          ON CREATE SET newRel = rel.props
        )
      )

      // Delete source's outgoing relationships
      WITH target, source
      OPTIONAL MATCH (source)-[r]->()
      DELETE r

      // Transfer incoming relationships
      WITH target, source
      OPTIONAL MATCH (other)-[r]->(source)
      WHERE NOT other:Meeting
      WITH target, source, collect({other: other, type: type(r), props: properties(r)}) as inRels
      FOREACH (rel IN inRels |
        FOREACH (_ IN CASE WHEN rel.other IS NOT NULL THEN [1] ELSE [] END |
          MERGE (rel.other)-[newRel:RELATED_TO]->(target)
          ON CREATE SET newRel = rel.props
        )
      )

      // Delete source's incoming relationships
      WITH target, source
      OPTIONAL MATCH ()-[r]->(source)
      DELETE r

      // Update target with combined data
      WITH target, source
      SET target.mention_count = coalesce(target.mention_count, 0) + coalesce(source.mention_count, 0),
          target.aliases = coalesce(target.aliases, []) + coalesce(source.aliases, []) + [source.display_value, source.normalized_value],
          target.updated_at = datetime()

      // Delete source entity
      WITH target, source
      DELETE source

      RETURN target as entity, labels(target) as types
      `,
      {
        targetId,
        sourceId,
        userId: user.id,
      }
    );

    if (!result) {
      return NextResponse.json(
        { error: "Merge failed. Entities may not exist." },
        { status: 404 }
      );
    }

    const types = (result.types as string[]) || [];
    const entityType =
      types.find((t) => t !== "Entity")?.toLowerCase() || "other";

    return NextResponse.json({
      success: true,
      entity: {
        ...(result.entity as Record<string, unknown>),
        type: entityType,
      },
    });
  } catch (error) {
    console.error("Error merging entities:", error);
    return NextResponse.json(
      { error: "Failed to merge entities" },
      { status: 500 }
    );
  }
}
