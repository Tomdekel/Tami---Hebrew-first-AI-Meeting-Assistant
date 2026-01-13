/**
 * Embeddings Generation Step
 *
 * Generates vector embeddings for semantic search:
 * - Chunks transcript into meaningful segments
 * - Generates embeddings via Gemini
 * - Stores in Supabase for pgvector search
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbeddings, chunkTranscriptForEmbedding } from "@/lib/ai/embeddings";
import { dedupeSegmentsByTimeAndText } from "@/lib/transcription/segments";
import type { PipelineState, StepResult } from "../types";

interface GenerateEmbeddingsResult {
  chunkCount: number;
}

export async function generateEmbeddingsStep(
  state: PipelineState,
  supabase: SupabaseClient
): Promise<StepResult<GenerateEmbeddingsResult>> {
  if (!state.transcriptId) {
    return {
      success: false,
      error: "No transcript ID available for embedding generation",
    };
  }

  try {
    console.log("[pipeline:generate-embeddings] Starting embedding generation...");

    // Get final segments (after refinement)
    // Note: is_deleted can be NULL (new segments) or false (not deleted)
    const { data: finalSegments } = await supabase
      .from("transcript_segments")
      .select("speaker_id, speaker_name, text, start_time, end_time, segment_order")
      .eq("transcript_id", state.transcriptId)
      .or("is_deleted.is.null,is_deleted.eq.false")
      .order("segment_order");

    if (!finalSegments || finalSegments.length === 0) {
      console.log("[pipeline:generate-embeddings] No segments to embed");
      return {
        success: true,
        data: { chunkCount: 0 },
      };
    }

    // Delete any existing embeddings for this session
    await supabase.from("memory_embeddings").delete().eq("session_id", state.sessionId);

    // Dedupe and chunk transcript
    const dedupedSegments = dedupeSegmentsByTimeAndText(finalSegments);
    const segments = dedupedSegments.map((seg) => ({
      speakerId: seg.speaker_id,
      speakerName: seg.speaker_name,
      text: seg.text,
      startTime: seg.start_time,
    }));

    const chunks = chunkTranscriptForEmbedding(segments);

    if (chunks.length === 0) {
      console.log("[pipeline:generate-embeddings] No chunks to embed");
      return {
        success: true,
        data: { chunkCount: 0 },
      };
    }

    // Generate embeddings
    const embeddings = await generateEmbeddings(chunks.map((c) => c.text));

    // Store embeddings with speaker_id for person-based retrieval
    const embeddingRecords = chunks.map((chunk, i) => ({
      user_id: state.userId,
      session_id: state.sessionId,
      content: chunk.text,
      embedding: `[${embeddings[i].embedding.join(",")}]`,
      metadata: {
        speaker_id: chunk.speakerId,
        speakerName: chunk.speakerName,
        startTime: chunk.startTime,
        segmentIndices: chunk.segmentIndices,
      },
    }));

    const { error: embeddingError } = await supabase
      .from("memory_embeddings")
      .insert(embeddingRecords);

    if (embeddingError) {
      throw new Error(`Failed to save embeddings: ${embeddingError.message}`);
    }

    console.log("[pipeline:generate-embeddings] Generated:", { chunkCount: chunks.length });

    return {
      success: true,
      data: { chunkCount: chunks.length },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Embedding generation failed";
    console.error("[pipeline:generate-embeddings] Error:", message);

    // Embeddings are optional
    return {
      success: true,
      data: { chunkCount: 0 },
    };
  }
}
