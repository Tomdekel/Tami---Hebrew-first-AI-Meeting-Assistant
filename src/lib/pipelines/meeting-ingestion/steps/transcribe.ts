/**
 * Transcription Step
 *
 * Handles audio-to-text conversion using:
 * - Whisper for English
 * - Ivrit AI (via RunPod) for Hebrew (async job)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getTranscriptionService } from "@/lib/transcription";
import type { PipelineState, PipelineOptions, StepResult, TranscriptionResult } from "../types";

interface TranscribeStepResult {
  transcriptId: string;
  result: TranscriptionResult;
  async: boolean;
  jobId?: string;
}

export async function transcribeStep(
  state: PipelineState,
  supabase: SupabaseClient,
  options?: PipelineOptions
): Promise<StepResult<TranscribeStepResult>> {
  const transcriptionService = getTranscriptionService();

  try {
    // For Hebrew: Use async job submission (Ivrit AI via RunPod)
    if (state.language === "he") {
      console.log("[pipeline:transcribe] Submitting async job to Ivrit AI...");

      const { jobId } = await transcriptionService.submitAsyncJob(state.audioUrl, {
        numSpeakers: options?.numSpeakers ?? 2,
        prompt: state.context || undefined,
      });

      console.log("[pipeline:transcribe] Job submitted:", { jobId });

      // Save job ID to session
      await supabase
        .from("sessions")
        .update({
          transcription_job_id: jobId,
          detected_language: state.language,
        })
        .eq("id", state.sessionId);

      return {
        success: true,
        data: {
          transcriptId: "",
          result: { fullText: "", language: "he", segments: [] },
          async: true,
          jobId,
        },
      };
    }

    // For English: Use sync Whisper
    console.log("[pipeline:transcribe] Starting Whisper transcription...");

    const audioResponse = await fetch(state.audioUrl);
    if (!audioResponse.ok) {
      throw new Error("Failed to fetch audio file");
    }
    const audioBlob = await audioResponse.blob();

    const result = await transcriptionService.transcribe(audioBlob, {
      numSpeakers: options?.numSpeakers ?? 2,
      prompt: state.context || undefined,
      language: "en",
    });

    // Save transcript to database
    const { data: transcript, error: transcriptError } = await supabase
      .from("transcripts")
      .insert({
        session_id: state.sessionId,
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
      // Delete any existing segments for this transcript
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
        console.error("[pipeline:transcribe] Failed to save segments:", segmentsError);
      }
    }

    // Calculate unique speaker count
    const uniqueSpeakers = new Set(result.segments.map((seg) => seg.speaker)).size;

    // Mark session as completed
    await supabase
      .from("sessions")
      .update({
        status: "completed",
        detected_language: state.language,
        duration_seconds: result.duration,
        participant_count: uniqueSpeakers,
        transcription_job_id: null,
      })
      .eq("id", state.sessionId);

    console.log("[pipeline:transcribe] Transcription completed:", {
      transcriptId: transcript.id,
      segmentCount: result.segments.length,
      duration: result.duration,
    });

    return {
      success: true,
      data: {
        transcriptId: transcript.id,
        result,
        async: false,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transcription failed";
    console.error("[pipeline:transcribe] Error:", message);

    return {
      success: false,
      error: message,
    };
  }
}
