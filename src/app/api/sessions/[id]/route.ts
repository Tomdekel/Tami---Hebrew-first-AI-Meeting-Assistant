import { createClient } from "@/lib/supabase/server";
import { dedupeSegmentsByTimeAndText } from "@/lib/transcription/segments";
import { NextRequest, NextResponse } from "next/server";
import type { Session, SessionWithRelations } from "@/lib/types/database";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sessions/[id] - Get a single session with relations
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get session with transcript, summary, and tags
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (sessionError) {
    if (sessionError.code === "PGRST116") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  // Get query params
  const sessionUrl = new URL(request.url);
  const includeTranscript = sessionUrl.searchParams.get("include_transcript") !== "false";

  // Get transcript with segments (only if requested)
  let transcript = null;

  if (includeTranscript) {
    const { data: fetchedTranscript } = await supabase
      .from("transcripts")
      .select(`
        *,
        segments:transcript_segments(*)
      `)
      .eq("session_id", id)
      .single();
    transcript = fetchedTranscript;
  }

  // Get summary with action items
  const { data: summary } = await supabase
    .from("summaries")
    .select(`
      *,
      action_items(*)
    `)
    .eq("session_id", id)
    .single();

  // Get tags through session_tags junction
  const { data: sessionTags } = await supabase
    .from("session_tags")
    .select(`
      tag:tags(*)
    `)
    .eq("session_id", id);

  const tags = sessionTags?.map((st) => st.tag).filter(Boolean) || [];

  const sortedSegments = transcript?.segments?.sort(
    (a: { segment_order: number }, b: { segment_order: number }) =>
      a.segment_order - b.segment_order
  ) || [];
  const dedupedSegments = dedupeSegmentsByTimeAndText(sortedSegments);

  const result: SessionWithRelations = {
    ...session,
    transcript: transcript
      ? {
        ...transcript,
        segments: dedupedSegments,
      }
      : undefined,
    summary: summary
      ? {
        ...summary,
        action_items: summary.action_items || [],
      }
      : undefined,
    tags,
  };

  return NextResponse.json({ session: result });
}

// PATCH /api/sessions/[id] - Update a session
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, context, status, audio_url, detected_language, duration_seconds } = body;

  // Build update object with only provided fields
  const updates: Partial<Session> = {};
  if (title !== undefined) updates.title = title;
  if (context !== undefined) updates.context = context;
  if (status !== undefined) updates.status = status;
  if (audio_url !== undefined) updates.audio_url = audio_url;
  if (detected_language !== undefined) updates.detected_language = detected_language;
  if (duration_seconds !== undefined) updates.duration_seconds = duration_seconds;

  const { data, error } = await supabase
    .from("sessions")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data as Session });
}

// DELETE /api/sessions/[id] - Delete a session
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Clean up Neo4j Knowledge Graph
    // remove session node, relationships, and decrement mention counts on entities
    try {
      const { runQuery } = await import("@/lib/neo4j/client");
      await runQuery(
        `
        MATCH (s:Session {id: $sessionId})
        OPTIONAL MATCH (e:Entity)-[r:MENTIONED_IN]->(s)
        SET e.mention_count = CASE 
          WHEN e.mention_count > 0 THEN e.mention_count - 1 
          ELSE 0 
        END
        DELETE r
        DETACH DELETE s
        `,
        { sessionId: id }
      );

      // Optional: Delete orphaned entities (mention_count = 0)
      // This is a design choice - keeping them might be useful for history, 
      // but deleting them keeps the graph clean exactly as requested.
      await runQuery(
        `
        MATCH (e:Entity)
        WHERE e.mention_count = 0 AND e.is_user_created = false
        DETACH DELETE e
        `
      );
    } catch (graphError) {
      console.error("Failed to clean up Knowledge Graph:", graphError);
      // Continue with deletion even if graph fails (don't block user)
    }

    // 2. Explicitly delete embeddings (in case cascade is not set up)
    await supabase.from("memory_embeddings").delete().eq("session_id", id);

    // 3. Delete session (cascades to transcripts, segments, summaries if FK configured)
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
