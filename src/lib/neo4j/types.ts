/**
 * TypeScript types for Neo4j Knowledge Graph
 */

export type EntityType =
  | "person"
  | "organization"
  | "project"
  | "topic"
  | "technology"
  | "product"
  | "location"
  | "date"
  | "other";

export type RelationshipType =
  | "MENTIONED_IN"
  | "WORKS_AT"
  | "MANAGES"
  | "COLLABORATES_WITH"
  | "ASSIGNED_TO"
  | "REPORTS_TO"
  | "USES"
  | "RELATED_TO"
  | "DEPENDS_ON"
  | "LOCATED_IN"
  | "SCHEDULED_FOR"
  | "CREATED_IN";

export interface GraphEntity {
  id: string;
  user_id: string;
  normalized_value: string;
  display_value: string;
  aliases: string[];
  description?: string;
  mention_count: number;
  confidence: number;
  first_seen: string;
  last_seen: string;
  sentiment_avg?: number;
  is_user_created: boolean;
  created_at: string;
  updated_at?: string;
  _labels?: string[];
}

export interface GraphMeeting {
  id: string;
  user_id: string;
  title: string;
  status: string;
  audio_url?: string;
  duration_seconds?: number;
  detected_language?: string;
  tags: string[];
  created_at: string;
}

export interface GraphActionItem {
  id: string;
  user_id: string;
  meeting_id?: string;
  description: string;
  status: "pending" | "in_progress" | "completed";
  assignee?: string;
  due_date?: string;
  priority: "low" | "medium" | "high";
  created_at: string;
}

export interface GraphRelationship {
  from: string;
  to: string;
  type: RelationshipType;
  properties: Record<string, unknown>;
}

/**
 * Relationship with full entity details (for UI display)
 */
export interface RelationshipWithEntities {
  id: string;
  sourceId: string;
  targetId: string;
  sourceName: string;
  targetName: string;
  sourceType?: string;
  targetType?: string;
  type: string;
  label: string;
  confidence: number;
  source: "user" | "ai" | "inferred";
}

/**
 * Entity as displayed in the entities page
 */
export interface DisplayEntity {
  id: string;
  typeId: string;
  name: string;
  metadata?: Record<string, string>;
  mentionCount: number;
  meetingCount: number;
  lastMeeting?: string;
  meetings?: { id: string; title: string; date: string }[];
  snippets?: { text: string; meetingId: string; timestamp: string }[];
  sentiment?: "positive" | "neutral" | "negative";
  confidence?: number;
  aliases?: string[];
  description?: string;
}

export interface EntityMention {
  meeting: GraphMeeting;
  context?: string;
  timestamp_start?: number;
  timestamp_end?: number;
  speaker?: string;
  mention_count: number;
}

export interface EntityWithRelations {
  entity: GraphEntity;
  type: EntityType;
  mentions: EntityMention[];
  relationships: {
    entity: GraphEntity;
    rel: RelationshipType;
    props: Record<string, unknown>;
  }[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  mention_count?: number;
  [key: string]: unknown;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  [key: string]: unknown;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CustomEntityType {
  id: string;
  user_id: string;
  name: string;
  name_en: string;
  color: string;
  icon: string;
  description?: string;
  examples: string[];
  created_at: string;
}

export interface EntityStats {
  [type: string]: number;
}

export interface SearchResult {
  entity: GraphEntity;
  type: EntityType;
  score: number;
}
