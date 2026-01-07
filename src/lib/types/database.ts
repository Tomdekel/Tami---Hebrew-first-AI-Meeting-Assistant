export type SessionStatus = "pending" | "recording" | "processing" | "completed" | "failed";
export type Language = "he" | "en" | "auto";
export type EntityType = "person" | "organization" | "project" | "topic" | "location" | "date" | "product" | "technology" | "other";
export type TagSource = "manual" | "auto:person" | "auto:organization" | "auto:project" | "auto:topic";
export type ChatRole = "user" | "assistant";

export interface Session {
  id: string;
  user_id: string;
  title: string | null;
  context: string | null;
  status: SessionStatus;
  audio_url: string | null;
  detected_language: Language | null;
  duration_seconds: number | null;
  created_at: string;
  updated_at: string;
}

export interface Transcript {
  id: string;
  session_id: string;
  language: string | null;
  full_text: string | null;
  created_at: string;
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
}

export interface Summary {
  id: string;
  session_id: string;
  overview: string | null;
  key_points: string[];
  created_at: string;
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

export interface MemoryEmbedding {
  id: string;
  user_id: string;
  session_id: string;
  chunk_text: string;
  embedding: number[];
  created_at: string;
}

// Extended types with relations
export interface SessionWithRelations extends Session {
  transcript?: Transcript & { segments: TranscriptSegment[] };
  summary?: Summary & { action_items: ActionItem[] };
  tags?: Tag[];
  entities?: Entity[];
}
