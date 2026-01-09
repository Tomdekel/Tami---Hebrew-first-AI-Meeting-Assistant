/**
 * Single Entity API
 *
 * GET /api/graph/entities/[id] - Get entity details
 * PATCH /api/graph/entities/[id] - Update entity
 * DELETE /api/graph/entities/[id] - Delete entity
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runQuery, runSingleQuery } from "@/lib/neo4j/client";

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

  try {
    const result = await runSingleQuery(
      `
      MATCH (e:Entity {id: $entityId, user_id: $userId})
      OPTIONAL MATCH (e)-[m:MENTIONED_IN]->(meeting:Meeting)
      OPTIONAL MATCH (e)-[r]->(related:Entity)
      WHERE type(r) <> 'MENTIONED_IN'
      WITH e, labels(e) as types,
           collect(DISTINCT {
             meeting: meeting,
             context: m.context,
             mention_count: m.mention_count
           }) as mentions,
           collect(DISTINCT {
             entity: related,
             rel: type(r),
             props: properties(r)
           }) as relationships
      RETURN e as entity, types, mentions, relationships
      `,
      { entityId: id, userId: user.id }
    );

    if (!result) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    const types = (result.types as string[]) || [];
    const entityType =
      types.find((t) => t !== "Entity")?.toLowerCase() || "other";

    return NextResponse.json({
      entity: {
        ...(result.entity as Record<string, unknown>),
        type: entityType,
      },
      mentions: (result.mentions as unknown[]).filter(
        (m: unknown) => (m as { meeting: unknown }).meeting !== null
      ),
      relationships: (result.relationships as unknown[]).filter(
        (r: unknown) => (r as { entity: unknown }).entity !== null
      ),
    });
  } catch (error) {
    console.error("Error fetching entity:", error);
    return NextResponse.json(
      { error: "Failed to fetch entity" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { display_value, description, aliases } = body;

    // Build SET clause dynamically
    const setClauses: string[] = ["e.updated_at = datetime()"];
    const queryParams: Record<string, unknown> = {
      entityId: id,
      userId: user.id,
    };

    if (display_value !== undefined) {
      setClauses.push("e.display_value = $display_value");
      queryParams.display_value = display_value;
    }

    if (description !== undefined) {
      setClauses.push("e.description = $description");
      queryParams.description = description;
    }

    if (aliases !== undefined) {
      setClauses.push("e.aliases = $aliases");
      queryParams.aliases = aliases;
    }

    const result = await runSingleQuery(
      `
      MATCH (e:Entity {id: $entityId, user_id: $userId})
      SET ${setClauses.join(", ")}
      RETURN e as entity, labels(e) as types
      `,
      queryParams
    );

    if (!result) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
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
    console.error("Error updating entity:", error);
    return NextResponse.json(
      { error: "Failed to update entity" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await runSingleQuery<{ deleted: number }>(
      `
      MATCH (e:Entity {id: $entityId, user_id: $userId})
      DETACH DELETE e
      RETURN count(e) as deleted
      `,
      { entityId: id, userId: user.id }
    );

    if (!result || result.deleted === 0) {
      return NextResponse.json({ error: "Entity not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting entity:", error);
    return NextResponse.json(
      { error: "Failed to delete entity" },
      { status: 500 }
    );
  }
}
