/**
 * Deep Refinement Step
 *
 * Post-processes transcript using the Faithful Pipeline for both Hebrew and English.
 *
 * FAITHFUL PIPELINE:
 * 1. Suspicion Gate: Deterministic checks identify potentially incorrect segments
 * 2. LLM Correction: Only suspicious segments sent to GPT-4o-mini
 * 3. Validation Gates: LLM output validated (LCS similarity, token changes, etc.)
 * 4. Apply/Reject: Only validated corrections are applied
 *
 * Benefits:
 * - ~4% LLM call rate for Hebrew, ~47% for English (vs 100% before)
 * - Preserves original speaker intent, doesn't rewrite or polish
 * - Conservative corrections with full traceability
 */

import { SupabaseClient } from "@supabase/supabase-js";
import {
  runFaithfulPipeline,
  InputSegment,
  FaithfulPipelineResult,
  FaithfulPipelineStats,
  tokenize,
} from "@/lib/experiments/faithful-pipeline";
import { computeLanguageFromSegments } from "@/lib/transcription/language-lock";
import {
  shouldDeleteAsHallucination,
  getHallucinationInfo,
} from "@/lib/transcription/deterministic/semantic-guards";
import type { PipelineState, StepResult } from "../types";

interface RefineStepResult {
  modifiedCount: number;
  deletedCount: number;
  /** Faithful pipeline stats */
  faithfulStats?: FaithfulPipelineStats;
  /** Number of failed database updates */
  failedUpdates?: number;
}

/** UUID validation regex */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Window for language detection in seconds */
const LANGUAGE_DETECTION_WINDOW_SECONDS = 120;

/** Type for DB segment rows */
interface DBSegment {
  id: string;
  segment_order: number;
  start_time: number;
  end_time?: number;
  speaker_id?: string;
  speaker_name: string | null;
  text: string;
}

/**
 * Delete hallucinated segments BEFORE the faithful pipeline runs.
 *
 * Marks segments as is_deleted=true in the database if they match
 * high-severity hallucination patterns (e.g., Knesset phrases).
 *
 * This is a deterministic pre-filter - no LLM involved.
 */
async function deleteHallucinations(
  supabase: SupabaseClient,
  transcriptId: string,
  segments: DBSegment[]
): Promise<number> {
  let deletedCount = 0;

  for (const segment of segments) {
    // Skip segments with null/empty text
    if (!segment.text) continue;

    if (shouldDeleteAsHallucination(segment.text)) {
      const hallucinationInfo = getHallucinationInfo(segment.text);

      const { error } = await supabase
        .from("transcript_segments")
        .update({ is_deleted: true })
        .eq("id", segment.id);

      if (!error) {
        deletedCount++;
        console.log(
          `[refine:hallucination] Deleted segment ${segment.segment_order}: "${segment.text.slice(0, 50)}..." (pattern: ${hallucinationInfo.pattern?.slice(0, 30) || "unknown"})`
        );
      } else {
        console.error(
          `[refine:hallucination] Failed to delete segment ${segment.id}:`,
          error
        );
      }
    }
  }

  return deletedCount;
}

/**
 * Convert database segments to InputSegment[] format for faithful pipeline.
 * Filters out invalid segments (empty text, negative order) with warnings.
 */
function dbSegmentsToInputSegments(
  dbSegments: Array<{
    id: string;
    segment_order: number;
    start_time: number;
    end_time?: number;
    speaker_id?: string;
    speaker_name: string | null;
    text: string;
  }>
): InputSegment[] {
  return dbSegments
    .filter((seg) => {
      // Filter out invalid segments
      if (!seg.text || seg.text.trim() === "") {
        console.warn(`[refine:faithful] Skipping segment ${seg.id}: empty text`);
        return false;
      }
      if (seg.segment_order < 0) {
        console.warn(
          `[refine:faithful] Skipping segment ${seg.id}: invalid order ${seg.segment_order}`
        );
        return false;
      }
      return true;
    })
    .map((seg) => ({
      segment_id: seg.id,
      segment_order: seg.segment_order,
      start_time_ms: Math.round((seg.start_time || 0) * 1000),
      // Fallback: if end_time is missing, use start_time (creates zero-duration segment)
      end_time_ms: Math.round((seg.end_time || seg.start_time || 0) * 1000),
      speaker_id: seg.speaker_id || "unknown",
      speaker_name: seg.speaker_name,
      text: seg.text.trim(),
      tokens: tokenize(seg.text),
    }));
}

/**
 * Apply faithful pipeline corrections back to database
 *
 * Only updates segments where corrections_applied is true.
 * The original_text column in the DB preserves the original for rollback.
 */
async function applyFaithfulCorrections(
  supabase: SupabaseClient,
  transcriptId: string,
  result: FaithfulPipelineResult
): Promise<{ modifiedCount: number; failedUpdates: number }> {
  let modifiedCount = 0;
  let failedUpdates = 0;

  for (const segment of result.segments) {
    // Only update segments where corrections were applied and text changed
    if (segment.corrections_applied && segment.text !== segment.original_text) {
      const { error } = await supabase
        .from("transcript_segments")
        .update({
          text: segment.text,
          // original_text is preserved from initial save
        })
        .eq("id", segment.segment_id);

      if (!error) {
        modifiedCount++;
      } else {
        failedUpdates++;
        console.error(
          `[refine:faithful] Failed to update segment ${segment.segment_id}:`,
          error
        );
      }
    }
  }

  if (failedUpdates > 0) {
    console.warn(`[refine:faithful] ${failedUpdates} segment updates failed`);
  }

  return { modifiedCount, failedUpdates };
}

/**
 * Refine step using the Faithful Pipeline
 *
 * Replaces the previous English/Hebrew-specific pipelines with a unified
 * approach that:
 * - Uses deterministic suspicion gate to identify problem segments
 * - Only sends suspicious segments to LLM
 * - Validates LLM corrections before applying
 */
export async function refineStep(
  state: PipelineState,
  supabase: SupabaseClient
): Promise<StepResult<RefineStepResult>> {
  // Validate required IDs
  if (!state.transcriptId) {
    return {
      success: false,
      error: "No transcript ID available for refinement",
    };
  }

  // Validate UUIDs to prevent injection
  if (!UUID_REGEX.test(state.transcriptId)) {
    return {
      success: false,
      error: "Invalid transcript ID format",
    };
  }
  if (!UUID_REGEX.test(state.sessionId)) {
    return {
      success: false,
      error: "Invalid session ID format",
    };
  }

  try {
    // Fetch segments from database
    const { data: dbSegments, error: fetchError } = await supabase
      .from("transcript_segments")
      .select(
        "id, segment_order, start_time, end_time, speaker_id, speaker_name, text"
      )
      .eq("transcript_id", state.transcriptId)
      .eq("is_deleted", false)
      .order("segment_order");

    if (fetchError) {
      console.error("[refine:faithful] Failed to fetch segments:", fetchError);
      return {
        success: false,
        error: `Failed to fetch segments: ${fetchError.message}`,
      };
    }

    if (!dbSegments || dbSegments.length === 0) {
      console.log("[refine:faithful] No segments to refine");
      return {
        success: true,
        data: { modifiedCount: 0, deletedCount: 0 },
      };
    }

    console.log(
      `[refine:faithful] Processing ${dbSegments.length} segments (language: ${state.language || "auto"})`
    );

    // Delete hallucinations FIRST (before faithful pipeline)
    // This removes obvious ASR artifacts like Knesset phrases
    const hallucinationsDeleted = await deleteHallucinations(
      supabase,
      state.transcriptId,
      dbSegments
    );

    // Use a mutable variable for working segments (may be replaced after deletion)
    let workingSegments = dbSegments;

    if (hallucinationsDeleted > 0) {
      console.log(
        `[refine:faithful] Deleted ${hallucinationsDeleted} hallucinated segments`
      );

      // Re-fetch non-deleted segments for faithful pipeline
      const { data: cleanSegments, error: refetchError } = await supabase
        .from("transcript_segments")
        .select(
          "id, segment_order, start_time, end_time, speaker_id, speaker_name, text"
        )
        .eq("transcript_id", state.transcriptId)
        .eq("is_deleted", false)
        .order("segment_order");

      if (refetchError) {
        console.error(
          "[refine:faithful] Failed to re-fetch segments:",
          refetchError
        );
        return {
          success: false,
          error: `Failed to re-fetch segments: ${refetchError.message}`,
        };
      }

      // Use clean segments for remaining processing
      workingSegments = cleanSegments || [];

      console.log(
        `[refine:faithful] Continuing with ${workingSegments.length} non-hallucinated segments`
      );
    }

    // Compute and save session language lock
    const segments = workingSegments.map((s) => ({ text: s.text, start: s.start_time }));
    const languageLock = computeLanguageFromSegments(
      segments,
      LANGUAGE_DETECTION_WINDOW_SECONDS
    );
    console.log(
      `[refine:faithful] Language lock: ${languageLock.language} (${(languageLock.latinPercent * 100).toFixed(1)}% Latin, confidence: ${languageLock.confidence})`
    );

    // Save session_language to database
    const { error: langUpdateError } = await supabase
      .from("sessions")
      .update({ session_language: languageLock.language })
      .eq("id", state.sessionId);

    if (langUpdateError) {
      console.warn("[refine:faithful] Failed to save session_language:", langUpdateError);
    } else {
      console.log(`[refine:faithful] Saved session_language: ${languageLock.language}`);
    }

    // Convert DB segments to InputSegment format
    const inputSegments = dbSegmentsToInputSegments(workingSegments);

    // Run faithful pipeline
    const result = await runFaithfulPipeline(inputSegments, {
      language: state.language || "he",
      sessionName: state.sessionId,
      onProgress: (completed, total, status) => {
        // Log progress every 20% or so
        if (completed === total || completed % Math.ceil(total / 5) === 0) {
          console.log(`[refine:faithful] ${status}`);
        }
      },
    });

    // Apply corrections to database
    const { modifiedCount, failedUpdates } = await applyFaithfulCorrections(
      supabase,
      state.transcriptId,
      result
    );

    // Log comprehensive stats
    console.log("[refine:faithful] Complete:", {
      hallucinationsDeleted,
      total: result.stats.total_segments,
      suspicious: result.stats.suspicious_segments,
      sentToLLM: result.stats.sent_to_llm,
      applied: result.stats.corrections_applied,
      rejected: result.stats.corrections_rejected,
      unchanged: result.stats.passed_through_unchanged,
      llmCallRate: `${((result.stats.sent_to_llm / result.stats.total_segments) * 100).toFixed(1)}%`,
      failedUpdates,
    });

    // Log sample of applied corrections for monitoring
    if (result.report?.edits && result.report.edits.length > 0) {
      console.log("[refine:faithful] Sample corrections:");
      for (const edit of result.report.edits.slice(0, 3)) {
        console.log(`  Segment ${edit.segment_order}:`);
        console.log(`    Before: "${edit.original_text.slice(0, 50)}..."`);
        console.log(`    After:  "${edit.refined_text.slice(0, 50)}..."`);
      }
    }

    // Log sample of rejected corrections for debugging
    if (result.report?.rejected_edits && result.report.rejected_edits.length > 0) {
      console.log("[refine:faithful] Sample rejections:");
      for (const rejection of result.report.rejected_edits.slice(0, 2)) {
        console.log(`  Segment ${rejection.segment_order}: ${rejection.rejection_reason}`);
      }
    }

    return {
      success: true,
      data: {
        modifiedCount,
        deletedCount: hallucinationsDeleted, // Pre-filtered hallucinations
        faithfulStats: result.stats,
        failedUpdates: failedUpdates > 0 ? failedUpdates : undefined,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Refinement failed";
    console.error("[refine:faithful] Error:", message);

    // Refinement is optional - don't fail the pipeline
    return {
      success: true,
      data: { modifiedCount: 0, deletedCount: 0 },
    };
  }
}
