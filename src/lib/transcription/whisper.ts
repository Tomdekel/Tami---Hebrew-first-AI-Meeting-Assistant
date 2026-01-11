import type { TranscriptResult, TranscriptionOptions, TranscriptionProvider } from "./types";
import { normalizeTranscriptSegments } from "./segments";

const OPENAI_API_URL = "https://api.openai.com/v1/audio/transcriptions";

interface WhisperResponse {
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }>;
}

export class WhisperProvider implements TranscriptionProvider {
  name = "whisper";
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async transcribe(
    audioBlob: Blob,
    options?: TranscriptionOptions
  ): Promise<TranscriptResult> {
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");

    if (options?.language && options.language !== "auto") {
      formData.append("language", options.language);
    }

    if (options?.prompt) {
      formData.append("prompt", options.prompt);
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Whisper API error: ${response.status} - ${error}`);
    }

    const data: WhisperResponse = await response.json();

    // Convert Whisper response to our format
    const segments = data.segments?.map((seg, index) => ({
      speaker: `Speaker ${(index % 2) + 1}`, // Whisper doesn't do diarization
      text: seg.text.trim(),
      start: seg.start,
      end: seg.end,
    })) || [{
      speaker: "Speaker 1",
      text: data.text.trim(),
      start: 0,
      end: data.duration || 0,
    }];

    const normalizedSegments = normalizeTranscriptSegments(segments, {
      maxSpeakers: options?.numSpeakers,
    });

    const fullText = normalizedSegments.map((seg) => seg.text).join(" ");

    return {
      language: data.language || "en",
      segments: normalizedSegments,
      fullText: fullText || data.text.trim(),
      duration: data.duration || 0,
    };
  }

  /**
   * Detect language from audio sample
   */
  async detectLanguage(audioBlob: Blob): Promise<string> {
    const formData = new FormData();
    formData.append("file", audioBlob, "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Language detection failed: ${response.status}`);
    }

    const data: WhisperResponse = await response.json();
    return data.language || "en";
  }
}

export function createWhisperProvider(): WhisperProvider {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }
  return new WhisperProvider(apiKey);
}
