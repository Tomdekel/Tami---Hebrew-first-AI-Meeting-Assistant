/**
 * GET /api/sessions/[id]/transcription-status
 *
 * Check async transcription job status (Hebrew via Ivrit AI/RunPod).
 * When job completes, saves transcript and runs enhancement pipeline.
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTranscriptionService } from "@/lib/transcription";
import {
  initializePipelineState,
  runEnhancementsPipeline,
} from "@/lib/pipelines/meeting-ingestion";
import { setProcessingStep } from "@/lib/pipelines/meeting-ingestion/processing-state";

const DEFAULT_PROCESSING_TIMEOUT_MINUTES = 180;
const DEFAULT_ORPHANED_JOB_GRACE_MINUTES = 10;

function parseTimeoutMinutes(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  // Authenticate
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get session
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

  // Check for timeout
  const timeoutMinutes = parseTimeoutMinutes(
    process.env.TRANSCRIPTION_PROCESSING_TIMEOUT_MINUTES,
    DEFAULT_PROCESSING_TIMEOUT_MINUTES
  );
  const orphanedGraceMinutes = parseTimeoutMinutes(
    process.env.TRANSCRIPTION_ORPHANED_JOB_GRACE_MINUTES,
    DEFAULT_ORPHANED_JOB_GRACE_MINUTES
  );

  const processingStartedAt = session.updated_at || session.created_at;
  const processingStartTime = new Date(processingStartedAt);
  const processingElapsedMs = Number.isNaN(processingStartTime.getTime())
    ? 0
    : Date.now() - processingStartTime.getTime();

  if (processingElapsedMs > timeoutMinutes * 60 * 1000) {
    await supabase
      .from("sessions")
      .update({ status: "expired", transcription_job_id: null })
      .eq("id", sessionId);

    await setProcessingStep(supabase, sessionId, "validation_cleanup", "failed", "Transcription timed out");

    return NextResponse.json({
      status: "expired",
      completed: false,
      error: `Transcription timed out after ${timeoutMinutes} minutes. Please retry.`,
      code: "TRANSCRIPTION_TIMEOUT",
    });
  }

  // If no job ID, something is wrong
  if (!session.transcription_job_id) {
    if (processingElapsedMs > orphanedGraceMinutes * 60 * 1000) {
      await supabase
        .from("sessions")
        .update({ status: "failed", transcription_job_id: null })
        .eq("id", sessionId);

      await setProcessingStep(supabase, sessionId, "validation_cleanup", "failed", "Transcription job orphaned");

      return NextResponse.json({
        status: "failed",
        completed: false,
        error: "Transcription job was not created. Please retry.",
        code: "TRANSCRIPTION_JOB_ORPHANED",
      });
    }

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

    // Job completed successfully
    if (jobStatus.status === "COMPLETED") {
      const result = transcriptionService.parseAsyncJobOutput(jobStatus);

      // Use upsert to prevent race condition creating duplicate transcripts
      // If transcript exists for this session, update it; otherwise insert new one
      const { data: transcript, error: transcriptError } = await supabase
        .from("transcripts")
        .upsert(
          {
            session_id: sessionId,
            language: result.language,
            full_text: result.fullText,
          },
          { onConflict: "session_id" }
        )
        .select()
        .single();

      if (transcriptError) {
        throw new Error(`Failed to save transcript: ${transcriptError.message}`);
      }
      console.log(`[transcription-status] Saved transcript ${transcript.id} for ${sessionId}`);

      // Save transcript segments
      if (result.segments.length > 0) {
        // Delete existing segments to prevent duplicates
        await supabase
          .from("transcript_segments")
          .delete()
          .eq("transcript_id", transcript.id);

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
          console.error("[transcription-status] Failed to save segments:", segmentsError);
        }
      }

      // Calculate unique speaker count
      const uniqueSpeakers = new Set(result.segments.map((seg) => seg.speaker)).size;

      // Mark session as completed IMMEDIATELY
      // Also update processing_state to prevent showing draft banner while enhancements run
      const { error: statusUpdateError } = await supabase
        .from("sessions")
        .update({
          status: "completed",
          processing_state: "processing", // Will be set to "completed" by enhancement pipeline
          duration_seconds: result.duration,
          transcription_job_id: null,
          participant_count: uniqueSpeakers,
        })
        .eq("id", sessionId);

      if (statusUpdateError) {
        console.error("[transcription-status] Failed to update session status:", {
          sessionId,
          error: statusUpdateError.message,
          code: statusUpdateError.code,
        });
        // Continue anyway - transcript is saved and enhancements will run
      }

      // Run enhancement pipeline (optional - can fail gracefully)
      const state = initializePipelineState(
        sessionId,
        user.id,
        session.audio_url,
        (result.language === "he" ? "he" : "en") as "en" | "he",
        session.context || undefined
      );
      state.transcriptId = transcript.id;
      state.transcriptionResult = result;

      // Run enhancements in background (don't block response)
      // NOTE: Error handling is now done inside runEnhancementsPipeline which updates DB state
      runEnhancementsPipeline(supabase, state)
        .then((result) => {
          if (!result.success) {
            console.error("[transcription-status] Enhancement pipeline failed:", result.error);
            // State already updated in runEnhancementsPipeline
          } else {
            console.log("[transcription-status] Enhancement pipeline completed successfully");
          }
        })
        .catch(async (err) => {
          // This catches unexpected errors not handled by runEnhancementsPipeline
          console.error("[transcription-status] Enhancement pipeline threw unexpected error:", err);
          try {
            await supabase
              .from("sessions")
              .update({ processing_state: "failed" })
              .eq("id", sessionId);
            await setProcessingStep(supabase, sessionId, "saved_to_memory", "failed",
              err instanceof Error ? err.message : "Enhancement pipeline crashed");
          } catch (dbErr) {
            console.error("[transcription-status] Failed to update error state:", dbErr);
          }
        });

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

    // Job failed
    if (jobStatus.status === "FAILED" || jobStatus.status === "CANCELLED") {
      console.error("[transcription-status] Job failed:", {
        sessionId,
        jobId: session.transcription_job_id,
        status: jobStatus.status,
        error: jobStatus.error,
      });

      // Parse error for user-friendly message
      let userError = jobStatus.error || "Transcription job failed";
      if (jobStatus.error?.includes("No segments meet minimum duration")) {
        userError = "ההקלטה קצרה מדי או לא מכילה דיבור מספיק לתמלול. נסה להקליט לפחות 10 שניות של דיבור רציף.";
      } else if (jobStatus.error?.includes("Diarization failed")) {
        userError = "לא הצלחנו לזהות דוברים בהקלטה. נסה להקליט עם דיבור ברור יותר.";
      }

      await supabase
        .from("sessions")
        .update({ status: "failed", transcription_job_id: null })
        .eq("id", sessionId);

      await setProcessingStep(supabase, sessionId, "validation_cleanup", "failed", userError);

      // Log full error details server-side for debugging
      console.error("[transcription-status] Job failed details:", {
        sessionId,
        jobId: session.transcription_job_id,
        jobStatus: jobStatus.status,
        technicalError: jobStatus.error,
      });

      // Return sanitized error to client (no internal details)
      return NextResponse.json({
        status: "failed",
        completed: false,
        error: userError,
      });
    }

    // Still processing (IN_QUEUE or IN_PROGRESS)
    // Add recommended polling interval to prevent excessive requests
    const pollingInterval = jobStatus.status === "IN_QUEUE" ? 5 : 3; // seconds
    return NextResponse.json(
      {
        status: "processing",
        completed: false,
        jobStatus: jobStatus.status,
        jobId: session.transcription_job_id,
        retryAfter: pollingInterval,
      },
      {
        headers: {
          "Retry-After": String(pollingInterval),
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("[transcription-status] Error:", {
      sessionId,
      jobId: session?.transcription_job_id,
      error: error instanceof Error ? error.message : error,
    });

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to check status",
        code: "TRANSCRIPTION_STATUS_ERROR",
        sessionId,
      },
      { status: 500 }
    );
  }
}
