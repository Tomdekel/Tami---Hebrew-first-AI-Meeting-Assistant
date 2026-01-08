import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTranscriptionService } from "@/lib/transcription";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sessions/[id]/transcription-status - Check async transcription status
export async function GET(request: NextRequest, { params }: RouteParams) {
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

  // If not processing, return current status
  if (session.status !== "processing") {
    return NextResponse.json({
      status: session.status,
      completed: session.status === "completed",
    });
  }

  // If no job ID, something is wrong
  if (!session.transcription_job_id) {
    return NextResponse.json({
      status: "processing",
      jobStatus: "unknown",
      message: "No job ID found - transcription may be running synchronously",
    });
  }

  try {
    // Check job status with RunPod
    const transcriptionService = getTranscriptionService();
    const jobStatus = await transcriptionService.checkAsyncJobStatus(session.transcription_job_id);

    // Handle different job states
    if (jobStatus.status === "COMPLETED") {
      // Parse the transcription result
      const result = transcriptionService.parseAsyncJobOutput(jobStatus);

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
          duration_seconds: result.duration,
          transcription_job_id: null, // Clear job ID
        })
        .eq("id", sessionId);

      return NextResponse.json({
        status: "completed",
        completed: true,
        transcript: {
          id: transcript.id,
          language: result.language,
          segmentCount: result.segments.length,
          duration: result.duration,
        },
      });
    }

    if (jobStatus.status === "FAILED" || jobStatus.status === "CANCELLED") {
      // Update session status to failed
      await supabase
        .from("sessions")
        .update({
          status: "failed",
          transcription_job_id: null,
        })
        .eq("id", sessionId);

      return NextResponse.json({
        status: "failed",
        completed: false,
        error: jobStatus.error || "Transcription job failed",
      });
    }

    // Still processing (IN_QUEUE or IN_PROGRESS)
    return NextResponse.json({
      status: "processing",
      completed: false,
      jobStatus: jobStatus.status,
    });
  } catch (error) {
    console.error("Error checking transcription status:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check status" },
      { status: 500 }
    );
  }
}
