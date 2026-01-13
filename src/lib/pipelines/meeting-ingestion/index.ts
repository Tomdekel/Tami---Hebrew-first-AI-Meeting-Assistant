/**
 * Meeting Ingestion Pipeline Orchestrator
 *
 * Coordinates the full flow of processing a meeting recording:
 * 1. Transcription (ASR) - Required
 * 2. Deep refinement - Optional
 * 3. Summary generation - Optional
 * 4. Entity extraction - Optional
 * 5. Embedding generation - Optional
 * 6. Relationship extraction - Optional
 *
 * The pipeline is designed to:
 * - Mark session complete IMMEDIATELY after transcription
 * - Run optional enhancements in sequence (can fail gracefully)
 * - Provide detailed logging for debugging
 * - Support both sync (English) and async (Hebrew) flows
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  transcribeStep,
  refineStep,
  summarizeStep,
  extractEntitiesStep,
  generateEmbeddingsStep,
  extractRelationshipsStep,
} from "./steps";
import type { PipelineState, PipelineOptions } from "./types";

export * from "./types";

export interface PipelineResult {
  success: boolean;
  async: boolean;
  jobId?: string;
  transcriptId?: string;
  error?: string;
  stats: {
    refinementApplied: boolean;
    summaryGenerated: boolean;
    entitiesExtracted: number;
    embeddingsGenerated: number;
    relationshipsCreated: number;
  };
}

/**
 * Initialize pipeline state from session data
 */
export function initializePipelineState(
  sessionId: string,
  userId: string,
  audioUrl: string,
  language: "en" | "he",
  context?: string
): PipelineState {
  return {
    sessionId,
    userId,
    language,
    audioUrl,
    context,
    status: "pending",
    errors: [],
  };
}

/**
 * Run the complete meeting ingestion pipeline
 *
 * For Hebrew: Returns immediately after submitting async job
 * For English: Runs full pipeline synchronously
 */
export async function runMeetingIngestionPipeline(
  supabase: SupabaseClient,
  state: PipelineState,
  options?: PipelineOptions
): Promise<PipelineResult> {
  const stats = {
    refinementApplied: false,
    summaryGenerated: false,
    entitiesExtracted: 0,
    embeddingsGenerated: 0,
    relationshipsCreated: 0,
  };

  try {
    // Step 1: Transcription (required)
    console.log("[pipeline] Starting transcription...");
    state.status = "transcribing";

    const transcribeResult = await transcribeStep(state, supabase, options);

    if (!transcribeResult.success) {
      throw new Error(transcribeResult.error || "Transcription failed");
    }

    // For Hebrew: Return immediately (async job)
    if (transcribeResult.data?.async) {
      return {
        success: true,
        async: true,
        jobId: transcribeResult.data.jobId,
        stats,
      };
    }

    // Update state with transcription results
    state.transcriptId = transcribeResult.data?.transcriptId;
    state.transcriptionResult = transcribeResult.data?.result;

    // Skip enhancements if requested
    if (options?.skipEnhancements) {
      return {
        success: true,
        async: false,
        transcriptId: state.transcriptId,
        stats,
      };
    }

    // Step 2: Deep Refinement (optional)
    console.log("[pipeline] Starting refinement...");
    state.status = "refining";

    const refineResult = await refineStep(state, supabase);
    if (refineResult.success && refineResult.data) {
      stats.refinementApplied = refineResult.data.modifiedCount > 0 || refineResult.data.deletedCount > 0;
    }

    // Step 3: Summary Generation (optional)
    console.log("[pipeline] Starting summary generation...");
    state.status = "summarizing";

    const summarizeResult = await summarizeStep(state, supabase);
    stats.summaryGenerated = summarizeResult.success;

    // Step 4: Entity Extraction (optional)
    console.log("[pipeline] Starting entity extraction...");
    state.status = "extracting_entities";

    const entitiesResult = await extractEntitiesStep(state, supabase);
    if (entitiesResult.success && entitiesResult.data) {
      stats.entitiesExtracted = entitiesResult.data.extractedCount;
    }

    // Step 5: Embedding Generation (optional)
    console.log("[pipeline] Starting embedding generation...");
    state.status = "generating_embeddings";

    const embeddingsResult = await generateEmbeddingsStep(state, supabase);
    if (embeddingsResult.success && embeddingsResult.data) {
      stats.embeddingsGenerated = embeddingsResult.data.chunkCount;
    }

    // Step 6: Relationship Extraction (optional, requires entities)
    if (stats.entitiesExtracted >= 2) {
      console.log("[pipeline] Starting relationship extraction...");
      state.status = "extracting_relationships";

      const relResult = await extractRelationshipsStep(state, supabase);
      if (relResult.success && relResult.data) {
        stats.relationshipsCreated = relResult.data.createdCount;
      }
    }

    state.status = "completed";
    console.log("[pipeline] Pipeline completed:", stats);

    return {
      success: true,
      async: false,
      transcriptId: state.transcriptId,
      stats,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    console.error("[pipeline] Error:", message);

    state.status = "failed";
    state.errors.push({
      step: state.status,
      message,
      timestamp: new Date(),
    });

    // Update session status to failed
    await supabase
      .from("sessions")
      .update({
        status: "failed",
        transcription_job_id: null,
      })
      .eq("id", state.sessionId);

    return {
      success: false,
      async: false,
      error: message,
      stats,
    };
  }
}

/**
 * Run only the enhancement steps (for async transcription completion)
 *
 * Called when Hebrew transcription job completes and we need
 * to run refinement, summary, entities, embeddings, relationships.
 */
export async function runEnhancementsPipeline(
  supabase: SupabaseClient,
  state: PipelineState
): Promise<Omit<PipelineResult, "async" | "jobId">> {
  const stats = {
    refinementApplied: false,
    summaryGenerated: false,
    entitiesExtracted: 0,
    embeddingsGenerated: 0,
    relationshipsCreated: 0,
  };

  if (!state.transcriptId) {
    return {
      success: false,
      error: "No transcript ID available",
      stats,
    };
  }

  try {
    // Step 1: Deep Refinement
    console.log("[pipeline:enhancements] Starting refinement...");
    const refineResult = await refineStep(state, supabase);
    if (refineResult.success && refineResult.data) {
      stats.refinementApplied = refineResult.data.modifiedCount > 0 || refineResult.data.deletedCount > 0;
    }

    // Step 2: Summary Generation
    console.log("[pipeline:enhancements] Starting summary...");
    const summarizeResult = await summarizeStep(state, supabase);
    stats.summaryGenerated = summarizeResult.success;

    // Step 3: Entity Extraction
    console.log("[pipeline:enhancements] Starting entity extraction...");
    const entitiesResult = await extractEntitiesStep(state, supabase);
    if (entitiesResult.success && entitiesResult.data) {
      stats.entitiesExtracted = entitiesResult.data.extractedCount;
    }

    // Step 4: Embedding Generation
    console.log("[pipeline:enhancements] Starting embeddings...");
    const embeddingsResult = await generateEmbeddingsStep(state, supabase);
    if (embeddingsResult.success && embeddingsResult.data) {
      stats.embeddingsGenerated = embeddingsResult.data.chunkCount;
    }

    // Step 5: Relationship Extraction
    if (stats.entitiesExtracted >= 2) {
      console.log("[pipeline:enhancements] Starting relationships...");
      const relResult = await extractRelationshipsStep(state, supabase);
      if (relResult.success && relResult.data) {
        stats.relationshipsCreated = relResult.data.createdCount;
      }
    }

    console.log("[pipeline:enhancements] Completed:", stats);

    return {
      success: true,
      transcriptId: state.transcriptId,
      stats,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Enhancement pipeline failed";
    console.error("[pipeline:enhancements] Error:", message);

    return {
      success: false,
      error: message,
      stats,
    };
  }
}
