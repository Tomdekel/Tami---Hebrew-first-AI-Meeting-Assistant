import { createWhisperProvider, WhisperProvider } from "./whisper";
import { createIvritProvider, IvritProvider } from "./ivrit";
import type { TranscriptResult, TranscriptionOptions, SupportedLanguage } from "./types";

export class TranscriptionService {
  private whisperProvider: WhisperProvider | null = null;
  private ivritProvider: IvritProvider | null = null;

  private getWhisperProvider(): WhisperProvider {
    if (!this.whisperProvider) {
      this.whisperProvider = createWhisperProvider();
    }
    return this.whisperProvider;
  }

  private getIvritProvider(): IvritProvider {
    if (!this.ivritProvider) {
      this.ivritProvider = createIvritProvider();
    }
    return this.ivritProvider;
  }

  /**
   * Detect language from audio sample using Whisper
   */
  async detectLanguage(audioSample: Blob): Promise<SupportedLanguage> {
    try {
      const whisper = this.getWhisperProvider();
      const detected = await whisper.detectLanguage(audioSample);

      // Map to our supported languages
      if (detected === "he" || detected === "hebrew") {
        return "he";
      }
      return "en"; // Default to English for any other language
    } catch (error) {
      console.error("Language detection failed, defaulting to Hebrew:", error);
      return "he"; // Default to Hebrew for this Hebrew-first app
    }
  }

  /**
   * Transcribe audio with automatic language detection and routing
   */
  async transcribeWithAutoRouting(
    audioBlob: Blob,
    options?: TranscriptionOptions
  ): Promise<{ result: TranscriptResult; detectedLanguage: SupportedLanguage }> {
    // Extract sample for language detection (first ~10 seconds)
    const sampleSize = Math.min(audioBlob.size, 160000); // ~10 seconds at 128kbps
    const audioSample = audioBlob.slice(0, sampleSize, audioBlob.type);

    // Detect language
    const detectedLanguage = await this.detectLanguage(audioSample);

    // Route to appropriate provider
    const result = await this.transcribe(audioBlob, {
      ...options,
      language: detectedLanguage,
    });

    return { result, detectedLanguage };
  }

  /**
   * Transcribe audio with specified language
   */
  async transcribe(
    audioBlob: Blob,
    options?: TranscriptionOptions & { language?: SupportedLanguage }
  ): Promise<TranscriptResult> {
    const language = options?.language || "auto";

    // If auto, detect first
    if (language === "auto") {
      const { result } = await this.transcribeWithAutoRouting(audioBlob, options);
      return result;
    }

    // Route to appropriate provider based on language
    if (language === "he") {
      try {
        const ivrit = this.getIvritProvider();
        return await ivrit.transcribe(audioBlob, options);
      } catch (error) {
        console.error("Ivrit transcription failed, falling back to Whisper:", error);
        // Fallback to Whisper
        const whisper = this.getWhisperProvider();
        return await whisper.transcribe(audioBlob, { ...options, language: "he" });
      }
    }

    // Default to Whisper for English and other languages
    const whisper = this.getWhisperProvider();
    return await whisper.transcribe(audioBlob, options);
  }

  /**
   * Transcribe with explicit provider choice
   */
  async transcribeWithProvider(
    audioBlob: Blob,
    provider: "whisper" | "ivrit",
    options?: TranscriptionOptions
  ): Promise<TranscriptResult> {
    if (provider === "ivrit") {
      const ivrit = this.getIvritProvider();
      return await ivrit.transcribe(audioBlob, options);
    }

    const whisper = this.getWhisperProvider();
    return await whisper.transcribe(audioBlob, options);
  }

  /**
   * Submit an async transcription job (for Hebrew via Ivrit AI)
   * Returns immediately with a job ID that can be polled for status
   *
   * @param audioBlobOrUrl - Either a Blob (for small files <10MB) or a URL string (for large files)
   * @param options - Transcription options
   */
  async submitAsyncJob(
    audioBlobOrUrl: Blob | string,
    options?: TranscriptionOptions
  ): Promise<{ jobId: string; provider: "ivrit" | "whisper" }> {
    // For now, only Ivrit supports async - Whisper is fast enough for sync
    const ivrit = this.getIvritProvider();
    const { jobId } = await ivrit.submitJob(audioBlobOrUrl, options);
    return { jobId, provider: "ivrit" };
  }

  /**
   * Check the status of an async transcription job
   */
  async checkAsyncJobStatus(jobId: string) {
    const ivrit = this.getIvritProvider();
    return await ivrit.checkJobStatus(jobId);
  }

  /**
   * Parse completed async job output into TranscriptResult
   */
  parseAsyncJobOutput(jobStatus: Awaited<ReturnType<IvritProvider["checkJobStatus"]>>): TranscriptResult {
    const ivrit = this.getIvritProvider();
    return ivrit.parseJobOutput(jobStatus);
  }
}

// Singleton instance
let transcriptionService: TranscriptionService | null = null;

export function getTranscriptionService(): TranscriptionService {
  if (!transcriptionService) {
    transcriptionService = new TranscriptionService();
  }
  return transcriptionService;
}
