import { z } from "zod";

export const createSessionSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  context: z.string().max(5000).optional().nullable(),
  audio_url: z.string().url().optional().nullable(),
  detected_language: z.enum(["he", "en"]).optional().nullable(),
  duration_seconds: z.number().positive().optional().nullable(),
});

export const updateSessionSchema = z.object({
  title: z.string().max(255).optional().nullable(),
  context: z.string().max(5000).optional().nullable(),
  status: z.enum(["recording", "pending", "processing", "completed", "failed"]).optional(),
  audio_url: z.string().url().optional().nullable(),
  detected_language: z.enum(["he", "en"]).optional().nullable(),
  duration_seconds: z.number().positive().optional().nullable(),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(10000, "Message is too long"),
});

export const transcribeOptionsSchema = z.object({
  language: z.enum(["he", "en", "auto"]).optional().default("auto"),
  numSpeakers: z.number().min(1).max(20).optional().default(10),
});

export const searchQuerySchema = z.object({
  query: z.string().min(1, "Search query is required").max(500),
  sessionId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).optional().default(50),
});

export const semanticSearchSchema = z.object({
  query: z.string().min(1, "Search query is required").max(1000),
  sessionId: z.string().uuid().optional(),
  limit: z.number().min(1).max(50).optional().default(10),
  threshold: z.number().min(0).max(1).optional().default(0.7),
});

export const tagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(50, "Tag name is too long"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format").optional().default("#6366f1"),
  source: z.enum(["user", "auto"]).optional().default("user"),
  is_visible: z.boolean().optional().default(true),
});

export const attachmentSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().max(100),
  size: z.number().positive().max(500 * 1024 * 1024), // 500MB max
});

export const actionItemSchema = z.object({
  description: z.string().min(1, "Description is required").max(1000),
  assignee: z.string().max(100).optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
});

export const updateActionItemSchema = z.object({
  description: z.string().min(1).max(1000).optional(),
  assignee: z.string().max(100).optional().nullable(),
  due_date: z.string().datetime().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  completed: z.boolean().optional(),
});

export const speakerUpdateSchema = z.object({
  speakers: z.array(z.object({
    speakerId: z.string(),
    newName: z.string().min(1, "Speaker name is required").max(100),
  })).min(1, "At least one speaker update is required"),
});

export const reprocessSchema = z.object({
  steps: z.array(
    z.enum(["transcription", "summary", "entities", "embeddings", "all"])
  ).min(1, "At least one step is required"),
});

export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type UpdateSessionInput = z.infer<typeof updateSessionSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
export type SemanticSearchInput = z.infer<typeof semanticSearchSchema>;
export type TagInput = z.infer<typeof tagSchema>;
export type AttachmentInput = z.infer<typeof attachmentSchema>;
export type ActionItemInput = z.infer<typeof actionItemSchema>;
export type UpdateActionItemInput = z.infer<typeof updateActionItemSchema>;
export type SpeakerUpdateInput = z.infer<typeof speakerUpdateSchema>;
export type ReprocessInput = z.infer<typeof reprocessSchema>;
