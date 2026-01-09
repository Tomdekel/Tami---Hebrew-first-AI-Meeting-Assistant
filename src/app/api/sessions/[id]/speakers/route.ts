import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id]/speakers
 * Get all unique speakers in a session's transcript
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get session with transcript segments
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(`
        id,
        user_id,
        transcripts (
          id,
          transcript_segments (
            speaker_id,
            speaker_name
          )
        )
      `)
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const transcript = session.transcripts?.[0];
    if (!transcript?.transcript_segments?.length) {
      return NextResponse.json({ speakers: [] });
    }

    // Get unique speakers
    const speakerMap = new Map<string, string>();
    for (const segment of transcript.transcript_segments) {
      if (!speakerMap.has(segment.speaker_id)) {
        speakerMap.set(segment.speaker_id, segment.speaker_name || segment.speaker_id);
      }
    }

    const speakers = Array.from(speakerMap.entries()).map(([id, name]) => ({
      speakerId: id,
      speakerName: name,
      segmentCount: transcript.transcript_segments.filter(
        (s: { speaker_id: string }) => s.speaker_id === id
      ).length,
    }));

    return NextResponse.json({ speakers });
  } catch (error) {
    console.error("Get speakers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/sessions/[id]/speakers
 * Update a speaker's name
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { speakerId, speakerName } = await request.json();

    if (!speakerId || !speakerName) {
      return NextResponse.json(
        { error: "speakerId and speakerName are required" },
        { status: 400 }
      );
    }

    // Get session to verify ownership
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(`
        id,
        user_id,
        transcripts (id)
      `)
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const transcriptId = session.transcripts?.[0]?.id;
    if (!transcriptId) {
      return NextResponse.json({ error: "No transcript found" }, { status: 400 });
    }

    // Update all segments with this speaker_id
    const { error: updateError, count } = await supabase
      .from("transcript_segments")
      .update({ speaker_name: speakerName })
      .eq("transcript_id", transcriptId)
      .eq("speaker_id", speakerId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      updatedSegments: count || 0,
    });
  } catch (error) {
    console.error("Update speaker error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]/speakers/merge
 * Merge two speakers (reassign all segments from source to target)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { sourceSpeakerId, targetSpeakerId, targetSpeakerName } = await request.json();

    if (!sourceSpeakerId || !targetSpeakerId) {
      return NextResponse.json(
        { error: "sourceSpeakerId and targetSpeakerId are required" },
        { status: 400 }
      );
    }

    if (sourceSpeakerId === targetSpeakerId) {
      return NextResponse.json(
        { error: "Source and target speakers must be different" },
        { status: 400 }
      );
    }

    // Get session to verify ownership
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(`
        id,
        user_id,
        transcripts (id)
      `)
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const transcriptId = session.transcripts?.[0]?.id;
    if (!transcriptId) {
      return NextResponse.json({ error: "No transcript found" }, { status: 400 });
    }

    // Verify both speaker IDs exist in this transcript
    const { data: sourceExists } = await supabase
      .from("transcript_segments")
      .select("speaker_id")
      .eq("transcript_id", transcriptId)
      .eq("speaker_id", sourceSpeakerId)
      .limit(1)
      .maybeSingle();

    const { data: targetExists } = await supabase
      .from("transcript_segments")
      .select("speaker_id")
      .eq("transcript_id", transcriptId)
      .eq("speaker_id", targetSpeakerId)
      .limit(1)
      .maybeSingle();

    if (!sourceExists || !targetExists) {
      return NextResponse.json(
        { error: "Invalid speaker IDs - speakers not found in this transcript" },
        { status: 400 }
      );
    }

    // Merge: Update all source speaker segments to target speaker
    const updateData: { speaker_id: string; speaker_name?: string } = {
      speaker_id: targetSpeakerId,
    };
    if (targetSpeakerName) {
      updateData.speaker_name = targetSpeakerName;
    }

    const { error: updateError, count } = await supabase
      .from("transcript_segments")
      .update(updateData)
      .eq("transcript_id", transcriptId)
      .eq("speaker_id", sourceSpeakerId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      mergedSegments: count || 0,
    });
  } catch (error) {
    console.error("Merge speakers error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
