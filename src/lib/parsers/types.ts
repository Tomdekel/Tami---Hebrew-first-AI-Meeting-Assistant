import type { IngestionConfidence, ExternalFormat } from "@/lib/types/database";

export interface TranscriptSegment {
  startTime: number | null; // seconds
  endTime: number | null; // seconds
  speaker: string | null;
  text: string;
}

export interface ParsedTranscript {
  segments: TranscriptSegment[];
  fullText: string;
  hasTimestamps: boolean;
  hasSpeakers: boolean;
  speakerNames: string[];
  confidence: IngestionConfidence;
  format: ExternalFormat;
}

export interface ParserOptions {
  defaultSpeakerPrefix?: string; // Default: "Speaker"
}
