/**
 * POST /api/sessions/[id]/transcribe
 *
 * Starts transcription for a session.
 * - For Hebrew: Submits async job to Ivrit AI (RunPod)
 * - For English: Runs sync Whisper transcription + all enhancements
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { getTranscriptionService } from "@/lib/transcription";
import {
  initializePipelineState,
  runMeetingIngestionPipeline,
} from "@/lib/pipelines/meeting-ingestion";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  // Authenticate user
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

  // Check minimum audio file size (10KB minimum for meaningful transcription)
  try {
    const headResponse = await fetch(session.audio_url, { method: "HEAD" });
    const contentLength = parseInt(headResponse.headers.get("content-length") || "0", 10);
    const MIN_AUDIO_SIZE = 10 * 1024; // 10KB

    if (contentLength < MIN_AUDIO_SIZE) {
      console.log("[transcribe] Audio file too small:", { sessionId, contentLength });
      return NextResponse.json(
        {
          error: "ההקלטה קצרה מדי לתמלול. יש להקליט לפחות 10 שניות של דיבור.",
          code: "AUDIO_TOO_SHORT",
          details: { fileSize: contentLength, minRequired: MIN_AUDIO_SIZE },
        },
        { status: 400 }
      );
    }
  } catch (sizeCheckError) {
    console.warn("[transcribe] Could not check audio file size:", sizeCheckError);
    // Continue anyway
  }

  // Check if already processing or completed
  if (session.status === "processing") {
    return NextResponse.json({ error: "Transcription already in progress" }, { status: 409 });
  }

  if (session.status === "completed") {
    return NextResponse.json({ error: "Session already transcribed" }, { status: 409 });
  }

  // Update status to processing
  const { error: statusUpdateError } = await supabase
    .from("sessions")
    .update({ status: "processing" })
    .eq("id", sessionId);

  if (statusUpdateError) {
    console.error("[transcribe] Failed to update status:", statusUpdateError);
    return NextResponse.json({ error: "Failed to start transcription" }, { status: 500 });
  }

  try {
    // Detect language if not set
    let detectedLanguage = session.detected_language as "en" | "he" | null;

    if (!detectedLanguage) {
      console.log("[transcribe] Auto-detecting language...");

      try {
        const transcriptionService = getTranscriptionService();

        // Fetch audio sample for detection
        const headResponse = await fetch(session.audio_url, { method: "HEAD" });
        const contentLength = parseInt(headResponse.headers.get("content-length") || "0", 10);
        const sampleSize = Math.min(contentLength, 160000);

        const audioResponse = await fetch(session.audio_url, {
          headers: sampleSize < contentLength ? { Range: `bytes=0-${sampleSize - 1}` } : {},
        });

        if (!audioResponse.ok) {
          console.warn("[transcribe] Failed to fetch audio for detection, defaulting to Hebrew");
          detectedLanguage = "he";
        } else {
          const audioBlob = await audioResponse.blob();
          const detected = await transcriptionService.detectLanguage(audioBlob);
          // detectLanguage returns "he" | "en" | "auto" but in practice only returns "he" or "en"
          detectedLanguage = detected === "auto" ? "he" : detected;
          console.log("[transcribe] Detected language:", detectedLanguage);
        }
      } catch (detectionError) {
        // If language detection fails for any reason, default to Hebrew (Hebrew-first app)
        console.warn("[transcribe] Language detection failed, defaulting to Hebrew:", detectionError);
        detectedLanguage = "he";
      }

      // Save detected language
      await supabase
        .from("sessions")
        .update({ detected_language: detectedLanguage })
        .eq("id", sessionId);
    }

    // Initialize pipeline state
    const state = initializePipelineState(
      sessionId,
      user.id,
      session.audio_url,
      detectedLanguage || "he",
      session.context || undefined
    );

    // Run the pipeline
    const result = await runMeetingIngestionPipeline(supabase, state, {
      context: session.context || undefined,
      numSpeakers: 2,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error || "Transcription failed",
          code: "TRANSCRIPTION_ERROR",
          sessionId,
        },
        { status: 500 }
      );
    }

    // Return response based on sync/async
    if (result.async) {
      // Save jobId to database BEFORE returning so polling can find it
      await supabase
        .from("sessions")
        .update({ transcription_job_id: result.jobId })
        .eq("id", sessionId);

      return NextResponse.json({
        success: true,
        async: true,
        jobId: result.jobId,
        message: "Transcription job submitted. Poll /transcription-status for updates.",
      });
    }

    return NextResponse.json({
      success: true,
      async: false,
      transcript: {
        id: result.transcriptId,
        language: detectedLanguage,
      },
      stats: result.stats,
    });
  } catch (error) {
    console.error("[transcribe] Error:", {
      sessionId,
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Update session status to failed
    await supabase
      .from("sessions")
      .update({
        status: "failed",
        transcription_job_id: null,
      })
      .eq("id", sessionId);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Transcription failed",
        code: "TRANSCRIPTION_ERROR",
        sessionId,
      },
      { status: 500 }
    );
  }
}
