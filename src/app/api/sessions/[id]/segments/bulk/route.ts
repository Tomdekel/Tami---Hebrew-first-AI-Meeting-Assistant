import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface BulkUpdateRequest {
  segmentOrders: number[];
  speakerId: string;
  speakerName: string;
}

/**
 * PATCH /api/sessions/[id]/segments/bulk
 * Update speaker for multiple segments at once (for speaker split)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify session ownership
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get request body
    const body: BulkUpdateRequest = await request.json();
    const { segmentOrders, speakerId, speakerName } = body;

    if (!segmentOrders || !Array.isArray(segmentOrders) || segmentOrders.length === 0) {
      return NextResponse.json({ error: "segmentOrders is required" }, { status: 400 });
    }

    if (!speakerId || !speakerName) {
      return NextResponse.json({ error: "speakerId and speakerName are required" }, { status: 400 });
    }

    // Get transcript for this session
    const { data: transcript } = await supabase
      .from("transcripts")
      .select("id")
      .eq("session_id", sessionId)
      .single();

    if (!transcript) {
      return NextResponse.json({ error: "Transcript not found" }, { status: 404 });
    }

    // Update segments
    const { data: updated, error: updateError } = await supabase
      .from("transcript_segments")
      .update({
        speaker_id: speakerId,
        speaker_name: speakerName,
      })
      .eq("transcript_id", transcript.id)
      .in("segment_order", segmentOrders)
      .select("id");

    if (updateError) {
      console.error("Bulk segment update error:", updateError);
      return NextResponse.json(
        { error: "Failed to update segments" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      updatedCount: updated?.length || 0,
    });
  } catch (error) {
    console.error("Bulk segment update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
