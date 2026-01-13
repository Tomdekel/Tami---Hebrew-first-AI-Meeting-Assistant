/**
 * Meeting Ingestion Pipeline Types
 *
 * This pipeline handles the full flow of processing a meeting:
 * 1. Transcription (ASR)
 * 2. Deep refinement
 * 3. Summary generation
 * 4. Entity extraction
 * 5. Embedding generation
 * 6. Relationship extraction
 */

import { SupabaseClient } from "@supabase/supabase-js";

export type PipelineStatus =
  | "pending"
  | "transcribing"
  | "refining"
  | "summarizing"
  | "extracting_entities"
  | "generating_embeddings"
  | "extracting_relationships"
  | "completed"
  | "failed";

export interface TranscriptSegment {
  speaker_id: string;
  speaker_name: string;
  text: string;
  start_time: number;
  end_time: number;
  segment_order: number;
  is_deleted?: boolean;
}

export interface TranscriptionResult {
  fullText: string;
  language: string;
  segments: Array<{
    speaker: string;
    text: string;
    start: number;
    end: number;
  }>;
  duration?: number;
}

export interface PipelineState {
  sessionId: string;
  userId: string;
  transcriptId?: string;
  language: "en" | "he";
  status: PipelineStatus;

  // Session data
  audioUrl: string;
  context?: string;

  // Transcription results
  transcriptionResult?: TranscriptionResult;
  segments?: TranscriptSegment[];

  // Processing results
  refinementApplied?: boolean;
  summaryGenerated?: boolean;
  entitiesExtracted?: number;
  embeddingsGenerated?: number;
  relationshipsExtracted?: number;

  // Error tracking
  errors: Array<{
    step: string;
    message: string;
    timestamp: Date;
  }>;
}

export interface PipelineOptions {
  /** Skip optional enhancement steps (refinement, summary, entities, embeddings, relationships) */
  skipEnhancements?: boolean;
  /** Meeting context for better transcription accuracy */
  context?: string;
  /** Expected number of speakers */
  numSpeakers?: number;
}

export interface StepResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

export type PipelineStep<T = void> = (
  state: PipelineState,
  supabase: SupabaseClient,
  options?: PipelineOptions
) => Promise<StepResult<T>>;
