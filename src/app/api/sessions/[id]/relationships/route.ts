import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractRelationships } from "@/lib/ai/relationships";
import { dedupeSegmentsByTimeAndText } from "@/lib/transcription/segments";
import { runQuery, runSingleQuery } from "@/lib/neo4j/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id]/relationships
 * Get extracted relationships for a session from Neo4j
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get session to verify ownership
    const { data: session } = await supabase
      .from("sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .single();

    if (!session || session.user_id !== user.id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Query relationships from Neo4j for entities mentioned in this meeting
    const results = await runQuery(
      `
      MATCH (e1:Entity {user_id: $userId})-[:MENTIONED_IN]->(m:Meeting {id: $sessionId})
      MATCH (e1)-[r]->(e2:Entity {user_id: $userId})
      WHERE type(r) <> 'MENTIONED_IN'
      RETURN
        e1.display_value as sourceName,
        e1.normalized_value as sourceNormalized,
        labels(e1) as sourceLabels,
        type(r) as relationshipType,
        r.confidence as confidence,
        r.context as context,
        e2.display_value as targetName,
        e2.normalized_value as targetNormalized,
        labels(e2) as targetLabels
      `,
      { userId: user.id, sessionId }
    );

    const relationships = results.map((r) => ({
      sourceName: r.sourceName,
      sourceType: ((r.sourceLabels as string[]) || [])
        .find((l) => l !== "Entity")
        ?.toLowerCase() || "other",
      targetName: r.targetName,
      targetType: ((r.targetLabels as string[]) || [])
        .find((l) => l !== "Entity")
        ?.toLowerCase() || "other",
      relationshipType: r.relationshipType,
      confidence: r.confidence ?? 0.8,
      context: r.context || "",
    }));

    return NextResponse.json({ relationships });
  } catch (error) {
    console.error("Get relationships error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]/relationships
 * Extract relationships from session transcript and save to Neo4j
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get session with transcript
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(`
        id,
        user_id,
        detected_language,
        transcripts (
          id,
          full_text,
          transcript_segments (
            speaker_name,
            text,
            segment_order,
            start_time,
            end_time
          )
        )
      `)
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const transcript = session.transcripts?.[0];
    if (!transcript?.transcript_segments?.length) {
      return NextResponse.json({ error: "No transcript found" }, { status: 400 });
    }

    // Get entities for this session
    const { data: mentions } = await supabase
      .from("entity_mentions")
      .select(`
        entities (
          type,
          value,
          normalized_value
        )
      `)
      .eq("session_id", sessionId);

    const entities = (mentions || [])
      .map((m) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const entity = (m.entities as any);
        if (!entity) return null;
        return {
          type: entity.type,
          value: entity.value,
          normalizedValue: entity.normalized_value,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    if (entities.length < 2) {
      return NextResponse.json({
        success: true,
        extractedCount: 0,
        message: "Not enough entities to extract relationships",
      });
    }

    // Format transcript
    const sortedSegments = transcript.transcript_segments.sort(
      (a: { segment_order: number }, b: { segment_order: number }) =>
        a.segment_order - b.segment_order
    );
    // Cast to include time fields for deduplication
    const segmentsWithTimes = sortedSegments as Array<{
      text: string;
      start_time: number;
      end_time: number;
      speaker_name?: string;
    }>;
    const dedupedSegments = dedupeSegmentsByTimeAndText(segmentsWithTimes);
    const formattedTranscript = dedupedSegments
      .map((seg) => `${seg.speaker_name || "Speaker"}: ${seg.text}`)
      .join("\n");

    // Extract relationships
    const result = await extractRelationships(
      formattedTranscript,
      entities,
      session.detected_language || "en"
    );

    // Save relationships to Neo4j
    let savedCount = 0;
    for (const rel of result.relationships) {
      try {
        // Find source and target entities in Neo4j
        const createResult = await runSingleQuery(
          `
          MATCH (source:Entity {user_id: $userId})
          WHERE toLower(source.normalized_value) = toLower($sourceNormalized)
             OR toLower(source.display_value) = toLower($sourceValue)
          MATCH (target:Entity {user_id: $userId})
          WHERE toLower(target.normalized_value) = toLower($targetNormalized)
             OR toLower(target.display_value) = toLower($targetValue)
          MERGE (source)-[r:${rel.relationshipType}]->(target)
          ON CREATE SET
            r.confidence = $confidence,
            r.context = $context,
            r.source = 'ai',
            r.session_id = $sessionId,
            r.created_at = datetime()
          RETURN source.id as sourceId, target.id as targetId
          `,
          {
            userId: user.id,
            sourceNormalized: rel.sourceValue.toLowerCase(),
            sourceValue: rel.sourceValue,
            targetNormalized: rel.targetValue.toLowerCase(),
            targetValue: rel.targetValue,
            confidence: rel.confidence,
            context: rel.context,
            sessionId,
          }
        );

        if (createResult) {
          savedCount++;
        }
      } catch (relError) {
        console.error("Failed to create relationship:", relError);
        // Continue with other relationships
      }
    }

    return NextResponse.json({
      success: true,
      extractedCount: result.relationships.length,
      savedCount,
      relationships: result.relationships,
    });
  } catch (error) {
    console.error("Relationship extraction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
