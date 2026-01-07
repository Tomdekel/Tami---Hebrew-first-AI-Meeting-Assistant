export interface TranscriptSegment {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface TranscriptResult {
  language: string;
  segments: TranscriptSegment[];
  fullText: string;
  duration: number;
}

export interface TranscriptionProvider {
  name: string;
  transcribe(audioBlob: Blob, options?: TranscriptionOptions): Promise<TranscriptResult>;
}

export interface TranscriptionOptions {
  language?: string;
  numSpeakers?: number;
  prompt?: string;
}

export type SupportedLanguage = "he" | "en" | "auto";
