/**
 * Summary Generation Step
 *
 * Generates meeting summary including:
 * - Overview
 * - Key points
 * - Decisions
 * - Action items
 * - Topics (auto-tagged)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { generateAndSaveSummary } from "@/lib/ai";
import type { PipelineState, StepResult } from "../types";

export async function summarizeStep(
  state: PipelineState,
  supabase: SupabaseClient
): Promise<StepResult<void>> {
  if (!state.transcriptId) {
    return {
      success: false,
      error: "No transcript ID available for summary generation",
    };
  }

  try {
    console.log("[pipeline:summarize] Generating summary...");

    const result = await generateAndSaveSummary(supabase, state.sessionId, state.userId, {
      context: state.context,
      language: state.language,
      transcriptId: state.transcriptId,
    });

    if (!result.success) {
      throw new Error(result.error || "Summary generation failed");
    }

    console.log("[pipeline:summarize] Summary generated for session:", state.sessionId);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Summary generation failed";
    console.error("[pipeline:summarize] Error:", message);

    // Summary is optional - don't fail the pipeline
    return { success: true };
  }
}
