/**
 * Graph Relationships API
 *
 * GET /api/graph/relationships - Get relationships for an entity
 * POST /api/graph/relationships - Create relationship between entities
 * DELETE /api/graph/relationships - Remove a relationship
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runQuery, runSingleQuery } from "@/lib/neo4j/client";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const entityId = searchParams.get("entityId");

  if (!entityId) {
    return NextResponse.json(
      { error: "Missing required parameter: entityId" },
      { status: 400 }
    );
  }

  try {
    // Get relationships where this entity is either source or target
    const results = await runQuery(
      `
      MATCH (source:Entity {user_id: $userId})-[r]->(target:Entity {user_id: $userId})
      WHERE source.id = $entityId OR target.id = $entityId
      AND type(r) <> 'MENTIONED_IN'
      RETURN
        elementId(r) as id,
        source.id as sourceId,
        target.id as targetId,
        source.display_value as sourceName,
        target.display_value as targetName,
        type(r) as type,
        r.label as label,
        r.confidence as confidence,
        r.source as relSource,
        labels(source) as sourceTypes,
        labels(target) as targetTypes
      `,
      { userId: user.id, entityId }
    );

    const relationships = results.map((r) => ({
      id: r.id,
      sourceId: r.sourceId,
      targetId: r.targetId,
      sourceName: r.sourceName,
      targetName: r.targetName,
      type: r.type,
      label: r.label || r.type,
      confidence: r.confidence ?? 1.0,
      source: r.relSource || "user",
      sourceType: ((r.sourceTypes as string[]) || [])
        .find((t) => t !== "Entity")
        ?.toLowerCase(),
      targetType: ((r.targetTypes as string[]) || [])
        .find((t) => t !== "Entity")
        ?.toLowerCase(),
    }));

    return NextResponse.json({ relationships });
  } catch (error) {
    console.error("Error fetching relationships:", error);
    return NextResponse.json(
      { error: "Failed to fetch relationships" },
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
    const { sourceId, targetId, type, label } = body;

    if (!sourceId || !targetId || !type) {
      return NextResponse.json(
        { error: "Missing required fields: sourceId, targetId, type" },
        { status: 400 }
      );
    }

    // Verify both entities belong to user and create relationship
    const result = await runSingleQuery(
      `
      MATCH (source:Entity {id: $sourceId, user_id: $userId})
      MATCH (target:Entity {id: $targetId, user_id: $userId})
      CREATE (source)-[r:${type} {
        label: $label,
        confidence: 1.0,
        source: 'user',
        created_at: datetime()
      }]->(target)
      RETURN
        elementId(r) as id,
        source.id as sourceId,
        target.id as targetId,
        source.display_value as sourceName,
        target.display_value as targetName,
        type(r) as type,
        r.label as label
      `,
      {
        sourceId,
        targetId,
        userId: user.id,
        label: label || type,
      }
    );

    if (!result) {
      return NextResponse.json(
        { error: "Failed to create relationship. Entities may not exist." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      relationship: {
        id: result.id,
        sourceId: result.sourceId,
        targetId: result.targetId,
        sourceName: result.sourceName,
        targetName: result.targetName,
        type: result.type,
        label: result.label,
        confidence: 1.0,
        source: "user",
      },
    });
  } catch (error) {
    console.error("Error creating relationship:", error);
    return NextResponse.json(
      { error: "Failed to create relationship" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const sourceId = searchParams.get("sourceId");
  const targetId = searchParams.get("targetId");
  const type = searchParams.get("type");

  if (!sourceId || !targetId || !type) {
    return NextResponse.json(
      { error: "Missing required parameters: sourceId, targetId, type" },
      { status: 400 }
    );
  }

  try {
    const result = await runSingleQuery<{ deleted: number }>(
      `
      MATCH (source:Entity {id: $sourceId, user_id: $userId})-[r:${type}]->(target:Entity {id: $targetId, user_id: $userId})
      DELETE r
      RETURN count(r) as deleted
      `,
      { sourceId, targetId, userId: user.id }
    );

    if (!result || result.deleted === 0) {
      return NextResponse.json(
        { error: "Relationship not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting relationship:", error);
    return NextResponse.json(
      { error: "Failed to delete relationship" },
      { status: 500 }
    );
  }
}
