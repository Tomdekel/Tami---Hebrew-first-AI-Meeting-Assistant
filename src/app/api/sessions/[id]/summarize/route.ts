import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { generateSummary } from "@/lib/ai";
import { dedupeSegmentsByTimeAndText } from "@/lib/transcription/segments";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/sessions/[id]/summarize - Update summary
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { overview, key_points, decisions } = body;

  // Find the summary for this session
  const { data: summary, error: findError } = await supabase
    .from("summaries")
    .select("id")
    .eq("session_id", sessionId)
    .single();

  if (findError || !summary) {
    return NextResponse.json({ error: "Summary not found" }, { status: 404 });
  }

  // Update the summary
  const updateData: Record<string, unknown> = { edited_at: new Date().toISOString() };
  if (overview !== undefined) updateData.overview = overview;
  if (key_points !== undefined) updateData.key_points = key_points;
  if (decisions !== undefined) updateData.decisions = decisions;

  const { data: updatedSummary, error: updateError } = await supabase
    .from("summaries")
    .update(updateData)
    .eq("id", summary.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Failed to update summary" }, { status: 500 });
  }

  return NextResponse.json({ success: true, summary: updatedSummary });
}

// POST /api/sessions/[id]/summarize - Generate summary for a session
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the session
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*, transcripts(*, transcript_segments(*))")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Check if transcript exists
  const transcript = session.transcripts?.[0];
  if (!transcript || !transcript.transcript_segments?.length) {
    return NextResponse.json({ error: "No transcript available" }, { status: 400 });
  }

  // Check if summary already exists
  const { data: existingSummary } = await supabase
    .from("summaries")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (existingSummary) {
    return NextResponse.json({ error: "Summary already exists" }, { status: 409 });
  }

  try {
    // Format segments for the AI
    const sortedSegments = transcript.transcript_segments.sort(
      (a: { segment_order: number }, b: { segment_order: number }) =>
        a.segment_order - b.segment_order
    );
    const dedupedSegments = dedupeSegmentsByTimeAndText(sortedSegments);
    const segments = dedupedSegments.map(
      (seg: { speaker_name: string; speaker_id: string; text: string }) => ({
        speaker: seg.speaker_name || seg.speaker_id,
        text: seg.text,
      })
    );

    // Generate summary
    const summaryResult = await generateSummary(
      segments,
      session.context || undefined,
      session.detected_language || "en"
    );

    // Save summary
    const { data: summary, error: summaryError } = await supabase
      .from("summaries")
      .insert({
        session_id: sessionId,
        overview: summaryResult.overview,
        key_points: summaryResult.keyPoints,
        decisions: summaryResult.decisions,
      })
      .select()
      .single();

    if (summaryError) {
      throw new Error(`Failed to save summary: ${summaryError.message}`);
    }

    // Save action items
    if (summaryResult.actionItems.length > 0) {
      const actionItems = summaryResult.actionItems.map((item) => ({
        summary_id: summary.id,
        description: item.description,
        assignee: item.assignee,
        deadline: item.deadline,
        completed: false,
      }));

      const { error: actionError } = await supabase
        .from("action_items")
        .insert(actionItems);

      if (actionError) {
        console.error("Failed to save action items:", actionError);
      }
    }

    // Save topics as auto-generated tags
    if (summaryResult.topics.length > 0) {
      for (const topic of summaryResult.topics) {
        // Create or get tag
        const { data: existingTag } = await supabase
          .from("tags")
          .select("id")
          .eq("user_id", user.id)
          .eq("name", topic)
          .single();

        let tagId = existingTag?.id;

        if (!tagId) {
          const { data: newTag } = await supabase
            .from("tags")
            .insert({
              user_id: user.id,
              name: topic,
              color: "#6366f1", // Default indigo
              source: "auto:topic",
              is_visible: true,
            })
            .select("id")
            .single();
          tagId = newTag?.id;
        }

        if (tagId) {
          // Link tag to session
          await supabase
            .from("session_tags")
            .upsert({ session_id: sessionId, tag_id: tagId });
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        id: summary.id,
        overview: summaryResult.overview,
        keyPoints: summaryResult.keyPoints,
        decisions: summaryResult.decisions,
        actionItems: summaryResult.actionItems,
        topics: summaryResult.topics,
      },
    });
  } catch (error) {
    console.error("Summary generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Summary generation failed" },
      { status: 500 }
    );
  }
}
