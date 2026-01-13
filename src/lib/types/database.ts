export type SessionStatus = "pending" | "recording" | "processing" | "refining" | "completed" | "failed" | "expired";
export type Language = "he" | "en" | "auto";
export type EntityType = "person" | "organization" | "project" | "topic" | "location" | "date" | "product" | "technology" | "other";
export type TagSource = "manual" | "auto:person" | "auto:organization" | "auto:project" | "auto:topic";
export type ChatRole = "user" | "assistant";

// Transcript ingestion types
export type SourceType = "recorded" | "imported" | "summary_only";
export type IngestionConfidence = "high" | "medium" | "low";
export type TranscriptOrigin = "asr" | "imported";
export type ExternalFormat = "vtt" | "srt" | "text" | "doc" | "pdf" | "md";

export interface Session {
  id: string;
  user_id: string;
  title: string | null;
  context: string | null;
  status: SessionStatus;
  audio_url: string | null;
  detected_language: Language | null;
  duration_seconds: number | null;
  transcription_job_id: string | null;
  participant_count: number | null;
  created_at: string;
  updated_at: string;
  // Transcript ingestion fields
  source_type: SourceType;
  source_metadata: Record<string, unknown>;
  has_timestamps: boolean;
  ingestion_confidence: IngestionConfidence;
}

export interface Transcript {
  id: string;
  session_id: string;
  language: string | null;
  full_text: string | null;
  created_at: string;
  // Transcript ingestion fields
  origin: TranscriptOrigin;
  external_format: ExternalFormat | null;
}

export interface TranscriptSegment {
  id: string;
  transcript_id: string;
  speaker_id: string;
  speaker_name: string | null;
  text: string;
  start_time: number;
  end_time: number;
  segment_order: number;
  is_deleted?: boolean;
}

export interface Decision {
  description: string;
  context: string | null;
}

export interface Note {
  title: string;
  emoji: string;
  startTime: string;
  endTime: string;
  bullets: string[];
}

export interface Summary {
  id: string;
  session_id: string;
  overview: string | null;
  key_points: string[];
  decisions?: Decision[];
  notes?: Note[];
  created_at: string;
  edited_at?: string | null;
  action_items?: ActionItem[];
}

export interface ActionItem {
  id: string;
  summary_id: string;
  description: string;
  assignee: string | null;
  deadline: string | null;
  completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: string;
  user_id: string;
  type: EntityType;
  value: string;
  normalized_value: string;
  mention_count: number;
  created_at: string;
  updated_at: string;
}

export interface EntityMention {
  id: string;
  entity_id: string;
  session_id: string;
  context: string | null;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  source: TagSource;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface SessionTag {
  session_id: string;
  tag_id: string;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  role: ChatRole;
  content: string;
  created_at: string;
}

export interface MemoryEmbeddingMetadata {
  speakerName?: string;
  speaker_id?: string;
  person_id?: string;
  startTime?: number;
  segmentIndices?: number[];
  source_type?: "transcript" | "attachment";
  attachment_id?: string;
  attachment_name?: string;
  chunk_index?: number;
}

export interface MemoryEmbedding {
  id: string;
  user_id: string;
  session_id: string;
  content: string;  // Note: actual column name is "content", not "chunk_text"
  embedding: number[];
  metadata: MemoryEmbeddingMetadata;
  created_at: string;
}

// Person-based retrieval types
export interface Person {
  id: string;
  user_id: string;
  display_name: string;
  normalized_key: string;
  aliases: string[];
  created_at: string;
  updated_at: string;
}

export interface SessionSpeaker {
  id: string;
  session_id: string;
  speaker_id: string;
  label: string;
  person_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SessionPerson {
  session_id: string;
  person_id: string;
  confidence: number;
  evidence: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SpeakerAssignmentEvent {
  id: string;
  user_id: string;
  session_id: string;
  speaker_id: string;
  old_person_id: string | null;
  new_person_id: string | null;
  created_at: string;
}

export type RelationshipSuggestionStatus = "pending" | "approved" | "rejected";

export interface RelationshipSuggestion {
  id: string;
  user_id: string;
  session_id: string;
  source_entity_id: string | null;
  target_entity_id: string | null;
  source_value: string;
  target_value: string;
  source_type: string;
  target_type: string;
  relationship_type: string;
  confidence: number;
  context: string | null;
  status: RelationshipSuggestionStatus;
  created_at: string;
  reviewed_at: string | null;
}

// Extended types with relations
export interface SessionWithRelations extends Session {
  transcript?: Transcript & { segments: TranscriptSegment[] };
  summary?: Summary;
  tags?: Tag[];
  entities?: Entity[];
}
