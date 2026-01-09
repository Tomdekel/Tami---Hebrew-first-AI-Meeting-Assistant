/**
 * Graph Visualization API
 *
 * GET /api/graph/visualize - Get graph data for visualization
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runQuery } from "@/lib/neo4j/client";
import { GraphNode, GraphEdge } from "@/lib/neo4j/types";

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
  const depth = parseInt(searchParams.get("depth") || "2");
  const limit = parseInt(searchParams.get("limit") || "50");

  try {
    let results: Record<string, unknown>[];

    if (entityId) {
      // Subgraph around specific entity
      results = await runQuery(
        `
        MATCH (start:Entity {id: $entityId, user_id: $userId})
        OPTIONAL MATCH path = (start)-[*1..${depth}]-(connected)
        WHERE connected:Entity OR connected:Meeting OR connected:ActionItem
        WITH start,
             collect(DISTINCT connected) as connected_nodes,
             [r IN collect(DISTINCT relationships(path)) | r] as all_rels
        RETURN start,
               connected_nodes,
               reduce(rels = [], rel_list IN all_rels |
                 rels + [r IN rel_list WHERE r IS NOT NULL]
               ) as relationships
        `,
        { entityId, userId: user.id }
      );
    } else {
      // Full user graph (limited to top entities)
      results = await runQuery(
        `
        MATCH (e:Entity {user_id: $userId})
        WITH e ORDER BY e.mention_count DESC LIMIT $limit
        OPTIONAL MATCH (e)-[r]-(connected)
        WHERE (connected:Entity AND connected.user_id = $userId)
           OR connected:Meeting
           OR connected:ActionItem
        WITH collect(DISTINCT e) as entities,
             collect(DISTINCT connected) as connected,
             collect(DISTINCT r) as relationships
        RETURN entities + [c IN connected WHERE c IS NOT NULL] as nodes,
               relationships
        `,
        { userId: user.id, limit }
      );
    }

    if (results.length === 0) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    const result = results[0];

    // Process nodes
    const nodesMap = new Map<string, GraphNode>();

    // Handle start node for entity-specific query
    if (result.start) {
      const startNode = result.start as Record<string, unknown>;
      const startLabels = (startNode._labels as string[]) || [];
      nodesMap.set(startNode.id as string, {
        id: startNode.id as string,
        label:
          (startNode.display_value as string) ||
          (startNode.normalized_value as string),
        type: startLabels.find((l) => l !== "Entity") || "Entity",
        mention_count: startNode.mention_count as number,
        ...startNode,
      });
    }

    // Handle nodes array
    const nodesArray = (result.nodes ||
      result.connected_nodes ||
      []) as Record<string, unknown>[];
    for (const node of nodesArray) {
      if (!node) continue;

      const id = node.id as string;
      if (!id || nodesMap.has(id)) continue;

      const labels = (node._labels as string[]) || [];
      const type = labels.find(
        (l) => l !== "Entity" && l !== "Meeting" && l !== "ActionItem"
      );

      nodesMap.set(id, {
        id,
        label:
          (node.display_value as string) ||
          (node.title as string) ||
          (node.description as string)?.slice(0, 30) ||
          (node.normalized_value as string) ||
          id.slice(0, 8),
        type: type || labels[0] || "Unknown",
        mention_count: node.mention_count as number,
        ...node,
      });
    }

    // Process relationships/edges
    const edges: GraphEdge[] = [];
    const seenEdges = new Set<string>();

    const relationships = (result.relationships || []) as Record<
      string,
      unknown
    >[];
    for (const rel of relationships) {
      if (!rel) continue;

      // Handle both direct relationships and nested relationship objects
      const relType = (rel._type as string) || (rel.type as string);
      const startId =
        (rel.startNodeElementId as string) ||
        (rel.start as string) ||
        (rel.from as string);
      const endId =
        (rel.endNodeElementId as string) ||
        (rel.end as string) ||
        (rel.to as string);

      if (!startId || !endId || !relType) continue;

      // Extract just the ID if it's a full element ID
      const sourceId = startId.includes(":")
        ? startId.split(":").pop()!
        : startId;
      const targetId = endId.includes(":") ? endId.split(":").pop()! : endId;

      const edgeKey = `${sourceId}-${relType}-${targetId}`;
      if (seenEdges.has(edgeKey)) continue;
      seenEdges.add(edgeKey);

      edges.push({
        source: sourceId,
        target: targetId,
        type: relType,
        ...(rel as object),
      });
    }

    return NextResponse.json({
      nodes: Array.from(nodesMap.values()),
      edges,
    });
  } catch (error) {
    console.error("Error fetching graph data:", error);
    return NextResponse.json(
      { error: "Failed to fetch graph data" },
      { status: 500 }
    );
  }
}
