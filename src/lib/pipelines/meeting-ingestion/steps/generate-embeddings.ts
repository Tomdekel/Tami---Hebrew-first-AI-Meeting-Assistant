/**
 * Embeddings Generation Step
 *
 * Generates vector embeddings for semantic search:
 * - Chunks transcript into meaningful segments
 * - Chunks summary content (overview, key_points, decisions, notes)
 * - Generates embeddings via Gemini
 * - Stores in Supabase for pgvector search
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { generateEmbeddings, chunkTranscriptForEmbedding } from "@/lib/ai/embeddings";
import { dedupeSegmentsByTimeAndText } from "@/lib/transcription/segments";
import type { PipelineState, StepResult } from "../types";

interface GenerateEmbeddingsResult {
  chunkCount: number;
  summaryChunkCount?: number;
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
      .select("id, speaker_id, speaker_name, text, start_time, end_time, segment_order")
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
      segmentId: seg.id,
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
        segmentIds: chunk.segmentIds,
      },
    }));

    const { error: embeddingError } = await supabase
      .from("memory_embeddings")
      .insert(embeddingRecords);

    if (embeddingError) {
      throw new Error(`Failed to save embeddings: ${embeddingError.message}`);
    }

    console.log("[pipeline:generate-embeddings] Transcript chunks:", { chunkCount: chunks.length });

    // Also embed summary content for semantic search
    let summaryChunkCount = 0;
    try {
      const { data: summary } = await supabase
        .from("summaries")
        .select("id, overview, key_points, decisions, notes")
        .eq("session_id", state.sessionId)
        .single();

      if (summary) {
        const summaryChunks: { content: string; field: string }[] = [];

        // Add each non-empty summary field as a chunk
        if (summary.overview?.trim()) {
          summaryChunks.push({ content: summary.overview, field: "overview" });
        }
        if (summary.key_points?.trim()) {
          summaryChunks.push({ content: summary.key_points, field: "key_points" });
        }
        if (summary.decisions?.trim()) {
          summaryChunks.push({ content: summary.decisions, field: "decisions" });
        }
        if (summary.notes?.trim()) {
          summaryChunks.push({ content: summary.notes, field: "notes" });
        }

        if (summaryChunks.length > 0) {
          const summaryEmbeddings = await generateEmbeddings(summaryChunks.map((c) => c.content));

          const summaryEmbeddingRecords = summaryChunks.map((chunk, i) => ({
            user_id: state.userId,
            session_id: state.sessionId,
            content: chunk.content,
            embedding: `[${summaryEmbeddings[i].embedding.join(",")}]`,
            metadata: {
              source_type: "summary",
              summary_field: chunk.field,
              summary_id: summary.id,
            },
          }));

          const { error: summaryEmbeddingError } = await supabase
            .from("memory_embeddings")
            .insert(summaryEmbeddingRecords);

          if (summaryEmbeddingError) {
            console.warn("[pipeline:generate-embeddings] Summary embedding error:", summaryEmbeddingError.message);
          } else {
            summaryChunkCount = summaryChunks.length;
            console.log("[pipeline:generate-embeddings] Summary chunks:", { summaryChunkCount });
          }
        }
      }
    } catch (summaryError) {
      console.warn("[pipeline:generate-embeddings] Summary embedding skipped:", summaryError);
    }

    console.log("[pipeline:generate-embeddings] Total embedded:", {
      transcriptChunks: chunks.length,
      summaryChunks: summaryChunkCount
    });

    return {
      success: true,
      data: { chunkCount: chunks.length, summaryChunkCount },
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
