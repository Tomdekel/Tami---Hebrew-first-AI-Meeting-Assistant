import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTranscriptionService } from "@/lib/transcription";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/sessions/[id]/transcribe - Start transcription for a session
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
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (!session.audio_url) {
    return NextResponse.json({ error: "Session has no audio file" }, { status: 400 });
  }

  // Check if already processing or completed
  if (session.status === "processing") {
    return NextResponse.json({ error: "Transcription already in progress" }, { status: 409 });
  }

  if (session.status === "completed") {
    return NextResponse.json({ error: "Session already transcribed" }, { status: 409 });
  }

  // Update status to processing
  await supabase
    .from("sessions")
    .update({ status: "processing" })
    .eq("id", sessionId);

  try {
    // Fetch the audio file
    const audioResponse = await fetch(session.audio_url);
    if (!audioResponse.ok) {
      throw new Error("Failed to fetch audio file");
    }

    const audioBlob = await audioResponse.blob();

    // Get transcription service and transcribe
    const transcriptionService = getTranscriptionService();
    const { result, detectedLanguage } = await transcriptionService.transcribeWithAutoRouting(
      audioBlob,
      {
        numSpeakers: 10,
        prompt: session.context || undefined,
      }
    );

    // Save transcript to database
    const { data: transcript, error: transcriptError } = await supabase
      .from("transcripts")
      .insert({
        session_id: sessionId,
        language: result.language,
        full_text: result.fullText,
      })
      .select()
      .single();

    if (transcriptError) {
      throw new Error(`Failed to save transcript: ${transcriptError.message}`);
    }

    // Save transcript segments
    if (result.segments.length > 0) {
      const segments = result.segments.map((seg, index) => ({
        transcript_id: transcript.id,
        speaker_id: seg.speaker.toLowerCase().replace(/\s+/g, "_"),
        speaker_name: seg.speaker,
        text: seg.text,
        start_time: seg.start,
        end_time: seg.end,
        segment_order: index,
      }));

      const { error: segmentsError } = await supabase
        .from("transcript_segments")
        .insert(segments);

      if (segmentsError) {
        console.error("Failed to save segments:", segmentsError);
      }
    }

    // Update session status to completed
    await supabase
      .from("sessions")
      .update({
        status: "completed",
        detected_language: detectedLanguage,
        duration_seconds: result.duration,
      })
      .eq("id", sessionId);

    return NextResponse.json({
      success: true,
      transcript: {
        id: transcript.id,
        language: result.language,
        segmentCount: result.segments.length,
        duration: result.duration,
      },
    });
  } catch (error) {
    console.error("Transcription failed:", error);

    // Update session status to failed
    await supabase
      .from("sessions")
      .update({ status: "failed" })
      .eq("id", sessionId);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
