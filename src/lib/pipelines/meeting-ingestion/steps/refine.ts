/**
 * Deep Refinement Step
 *
 * Post-processes transcript using GPT-4o to:
 * - Fix grammar/spelling
 * - Correct speaker names
 * - Normalize Hebrew/English mixing
 * - Remove hallucinations
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { deepRefineTranscript, applyDeepRefinements } from "@/lib/transcription/refinement";
import type { PipelineState, StepResult } from "../types";

interface RefineStepResult {
  modifiedCount: number;
  deletedCount: number;
}

export async function refineStep(
  state: PipelineState,
  supabase: SupabaseClient
): Promise<StepResult<RefineStepResult>> {
  if (!state.transcriptId) {
    return {
      success: false,
      error: "No transcript ID available for refinement",
    };
  }

  try {
    // Get segments from database
    const { data: dbSegments } = await supabase
      .from("transcript_segments")
      .select("speaker_name, text, start_time, segment_order")
      .eq("transcript_id", state.transcriptId)
      .order("segment_order");

    if (!dbSegments || dbSegments.length === 0) {
      console.log("[pipeline:refine] No segments to refine");
      return {
        success: true,
        data: { modifiedCount: 0, deletedCount: 0 },
      };
    }

    console.log("[pipeline:refine] Starting deep refinement...");

    const refinementResult = await deepRefineTranscript(dbSegments, {
      meetingContext: state.context || undefined,
      language: state.language,
    });

    const { modifiedCount, deletedCount } = await applyDeepRefinements(
      supabase,
      state.transcriptId,
      refinementResult
    );

    console.log("[pipeline:refine] Refinement complete:", { modifiedCount, deletedCount });

    return {
      success: true,
      data: { modifiedCount, deletedCount },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refinement failed";
    console.error("[pipeline:refine] Error:", message);

    // Refinement is optional - don't fail the pipeline
    return {
      success: true,
      data: { modifiedCount: 0, deletedCount: 0 },
    };
  }
}
