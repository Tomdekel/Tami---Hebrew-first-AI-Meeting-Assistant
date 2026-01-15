/**
 * Graph Visualization API
 *
 * GET /api/graph/visualize - Get graph data for visualization
 *
 * Refactored to use Postgres as primary data source for reliability.
 * Neo4j is used only for explicit relationships (additive).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runQuery } from "@/lib/neo4j/client";
import { GraphNode, GraphEdge } from "@/lib/neo4j/types";

// Entities appearing in more than this % of sessions are considered noise
const NOISE_THRESHOLD = 0.4;

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

  // Validate and bound input parameters
  const rawLimit = parseInt(searchParams.get("limit") || "50");
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200);

  try {
    // Step 1: Fetch entities from Postgres (primary source)
    let entitiesQuery = supabase
      .from("entities")
      .select("id, value, type, normalized_value, mention_count")
      .eq("user_id", user.id)
      .order("mention_count", { ascending: false });

    if (entityId) {
      // For entity-specific view, we'll handle this differently
      entitiesQuery = entitiesQuery.eq("id", entityId);
    } else {
      entitiesQuery = entitiesQuery.limit(limit * 2); // Fetch extra for filtering
    }

    const { data: allEntities, error: entitiesError } = await entitiesQuery;

    if (entitiesError) {
      console.error("Error fetching entities:", entitiesError);
      return NextResponse.json({ error: "Failed to fetch entities" }, { status: 500 });
    }

    if (!allEntities || allEntities.length === 0) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    const entityIds = allEntities.map(e => e.id);

    // Step 2: Get total session count for frequency filtering
    const { count: totalSessions } = await supabase
      .from("sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    // Step 3: Get session counts per entity for frequency filtering
    const { data: allMentions } = await supabase
      .from("entity_mentions")
      .select("entity_id, session_id")
      .in("entity_id", entityIds);

    // Calculate unique session count per entity
    const entitySessionCount = new Map<string, Set<string>>();
    if (allMentions) {
      for (const mention of allMentions) {
        if (!entitySessionCount.has(mention.entity_id)) {
          entitySessionCount.set(mention.entity_id, new Set());
        }
        entitySessionCount.get(mention.entity_id)!.add(mention.session_id);
      }
    }

    // Step 4: Filter out noisy entities (appear in too many sessions)
    const filteredEntities = allEntities.filter(entity => {
      if (!totalSessions || totalSessions === 0) return true;
      const sessionCount = entitySessionCount.get(entity.id)?.size || 0;
      const ratio = sessionCount / totalSessions;
      return ratio <= NOISE_THRESHOLD;
    }).slice(0, limit); // Apply limit after filtering

    if (filteredEntities.length === 0) {
      return NextResponse.json({ nodes: [], edges: [] });
    }

    // Step 5: Build nodes map
    const nodesMap = new Map<string, GraphNode>();
    for (const entity of filteredEntities) {
      nodesMap.set(entity.id, {
        id: entity.id,
        label: entity.value,
        type: entity.type || "Unknown",
        mention_count: entity.mention_count || 1,
        normalized_value: entity.normalized_value,
      });
    }

    // Step 6: Build co-mention edges from Postgres
    const edges: GraphEdge[] = [];
    const seenEdges = new Set<string>();
    const filteredEntityIds = new Set(filteredEntities.map(e => e.id));

    // Group mentions by session
    const sessionToEntities = new Map<string, string[]>();
    if (allMentions) {
      for (const mention of allMentions) {
        // Only include entities that passed filtering
        if (!filteredEntityIds.has(mention.entity_id)) continue;

        if (!sessionToEntities.has(mention.session_id)) {
          sessionToEntities.set(mention.session_id, []);
        }
        sessionToEntities.get(mention.session_id)!.push(mention.entity_id);
      }
    }

    // Create edges between entities in same session
    for (const [, sessionEntityIds] of sessionToEntities) {
      // Need at least 2 entities in same session to create an edge
      if (sessionEntityIds.length < 2) continue;

      // Create edges between pairs
      for (let i = 0; i < sessionEntityIds.length; i++) {
        for (let j = i + 1; j < sessionEntityIds.length; j++) {
          const [sourceId, targetId] = [sessionEntityIds[i], sessionEntityIds[j]].sort();
          const edgeKey = `${sourceId}-MENTIONED_TOGETHER-${targetId}`;

          if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
            edges.push({
              source: sourceId,
              target: targetId,
              type: "MENTIONED_TOGETHER",
            });
          }
        }
      }
    }

    // Step 7: Try to add explicit Neo4j relationships (if configured)
    if (process.env.NEO4J_URI && process.env.NEO4J_USERNAME && process.env.NEO4J_PASSWORD) {
      try {
        const neo4jIds = Array.from(filteredEntityIds);
        const neo4jResults = await runQuery(
          `
          MATCH (source:Entity {user_id: $userId})-[r]->(target:Entity {user_id: $userId})
          WHERE source.id IN $entityIds AND target.id IN $entityIds
          AND type(r) <> 'MENTIONED_IN'
          RETURN source.id as sourceId, target.id as targetId, type(r) as type
          `,
          { userId: user.id, entityIds: neo4jIds }
        );

        // Add Neo4j relationships (these override MENTIONED_TOGETHER)
        for (const rel of neo4jResults) {
          const sourceId = rel.sourceId as string;
          const targetId = rel.targetId as string;
          const relType = rel.type as string;

          if (!sourceId || !targetId || !relType) continue;

          // Check if we already have a MENTIONED_TOGETHER edge between these
          const mentionedKey = `${[sourceId, targetId].sort().join("-")}-MENTIONED_TOGETHER-${[sourceId, targetId].sort().join("-")}`.split("-").slice(0, 3).join("-");

          // Remove the MENTIONED_TOGETHER edge if we have an explicit relationship
          const existingIndex = edges.findIndex(e =>
            (e.source === sourceId && e.target === targetId && e.type === "MENTIONED_TOGETHER") ||
            (e.source === targetId && e.target === sourceId && e.type === "MENTIONED_TOGETHER")
          );
          if (existingIndex !== -1) {
            edges.splice(existingIndex, 1);
          }

          const edgeKey = `${sourceId}-${relType}-${targetId}`;
          if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
            edges.push({
              source: sourceId,
              target: targetId,
              type: relType,
            });
          }
        }
      } catch (neo4jError) {
        // Neo4j is optional - log and continue
        console.log("Neo4j query failed (optional):", neo4jError);
      }
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
