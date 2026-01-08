import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTranscriptionService } from "@/lib/transcription";
import { deepRefineTranscript, applyDeepRefinements } from "@/lib/transcription/refinement";
import { generateAndSaveSummary } from "@/lib/ai";

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

  // If not processing or refining, return current status
  if (session.status !== "processing" && session.status !== "refining") {
    return NextResponse.json({
      status: session.status,
      completed: session.status === "completed",
    });
  }

  // If refining, return that status
  if (session.status === "refining") {
    return NextResponse.json({
      status: "refining",
      completed: false,
      message: "AI is improving transcript accuracy",
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

      // Save transcript segments (raw from ASR)
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

      // Update status to "refining" - AI is improving accuracy
      await supabase
        .from("sessions")
        .update({
          status: "refining",
          duration_seconds: result.duration,
          transcription_job_id: null, // Clear job ID
        })
        .eq("id", sessionId);

      // Run deep refinement in the background
      // We return immediately with "refining" status, client will poll
      try {
        // Fetch segments for refinement
        const { data: dbSegments } = await supabase
          .from("transcript_segments")
          .select("speaker_name, text, start_time, segment_order")
          .eq("transcript_id", transcript.id)
          .order("segment_order");

        if (dbSegments && dbSegments.length > 0) {
          // Run deep refinement
          const refinementResult = await deepRefineTranscript(dbSegments, {
            meetingContext: session.context || undefined,
            language: result.language === "he" ? "he" : "en",
          });

          // Apply refinements to database
          const { modifiedCount, deletedCount } = await applyDeepRefinements(
            supabase,
            transcript.id,
            refinementResult
          );

          console.log(`Deep refinement: ${modifiedCount} modified, ${deletedCount} deleted`);
        }
      } catch (refinementError) {
        // Log but don't fail - raw transcript is still available
        console.error("Deep refinement failed:", refinementError);
      }

      // Auto-generate summary
      try {
        await generateAndSaveSummary(supabase, sessionId, user.id, {
          context: session.context || undefined,
          language: result.language,
          transcriptId: transcript.id,
        });
        console.log(`Auto-summary generated for session ${sessionId}`);
      } catch (summaryError) {
        // Log but don't fail - summary can be generated manually later
        console.error("Auto-summary failed:", summaryError);
      }

      // Update session status to completed
      await supabase
        .from("sessions")
        .update({ status: "completed" })
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
