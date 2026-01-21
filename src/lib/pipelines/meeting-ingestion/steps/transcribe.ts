/**
 * Transcription Step
 *
 * Handles audio-to-text conversion using:
 * - Whisper for English
 * - Ivrit AI (via RunPod) for Hebrew (async job)
 *
 * Pre-processing: Trims leading silence to prevent Whisper hallucinations
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { getTranscriptionService } from "@/lib/transcription";
import { trimLeadingSilence } from "@/lib/audio/silence-trimmer";
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

      // Check file size first without downloading the whole file
      const MAX_BLOB_SIZE_MB = 10;
      const headResponse = await fetch(state.audioUrl, { method: "HEAD" });
      const contentLength = headResponse.headers.get("content-length");
      const fileSizeMB = contentLength ? parseInt(contentLength, 10) / (1024 * 1024) : 0;

      console.log(`[pipeline:transcribe] File size: ${fileSizeMB.toFixed(2)}MB`);

      let audioBlobOrUrl: Blob | string;

      if (fileSizeMB > MAX_BLOB_SIZE_MB) {
        // For large files (>10MB): Use URL directly, skip trimming
        // This avoids Ivrit API's 10MB body limit and RLS upload issues
        console.log(`[pipeline:transcribe] File exceeds ${MAX_BLOB_SIZE_MB}MB, using URL directly (skipping silence trim)`);
        audioBlobOrUrl = state.audioUrl;
      } else {
        // For small files (<10MB): Fetch, trim silence, send as blob
        console.log(`[pipeline:transcribe] File is within ${MAX_BLOB_SIZE_MB}MB limit, fetching for silence trim...`);

        const audioResponse = await fetch(state.audioUrl);
        if (!audioResponse.ok) {
          throw new Error("Failed to fetch audio file for Hebrew transcription");
        }
        const contentType = audioResponse.headers.get("content-type") || "audio/m4a";
        const audioBlob = new Blob([await audioResponse.arrayBuffer()], { type: contentType });

        // Trim leading silence (prevents Knesset hallucinations from Ivrit AI training data)
        const { blob: trimmedBlob, trimmedSeconds, wasProcessed } = await trimLeadingSilence(audioBlob);
        if (wasProcessed && trimmedSeconds > 0) {
          console.log(`[pipeline:transcribe] Trimmed ${trimmedSeconds.toFixed(2)}s of leading silence`);
        } else if (!wasProcessed) {
          console.log("[pipeline:transcribe] Silence trimming skipped (FFmpeg unavailable)");
        }

        audioBlobOrUrl = trimmedBlob;
      }

      const { jobId } = await transcriptionService.submitAsyncJob(audioBlobOrUrl, {
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

    // Trim leading silence to prevent Whisper hallucinations
    const { blob: trimmedBlob, trimmedSeconds, wasProcessed } = await trimLeadingSilence(audioBlob);
    if (wasProcessed && trimmedSeconds > 0) {
      console.log(`[pipeline:transcribe] Trimmed ${trimmedSeconds.toFixed(2)}s of leading silence`);
    } else if (!wasProcessed) {
      console.log("[pipeline:transcribe] Silence trimming skipped (FFmpeg unavailable)");
    }

    const result = await transcriptionService.transcribe(trimmedBlob, {
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
