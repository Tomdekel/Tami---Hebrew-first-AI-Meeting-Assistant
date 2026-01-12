import type { TranscriptResult, TranscriptionOptions, TranscriptionProvider, TranscriptSegment } from "./types";
import { normalizeTranscriptSegments } from "./segments";

// Actual format from Ivrit AI RunPod endpoint
interface IvritOutputSegment {
  start: number;
  end: number;
  text: string;
  speakers?: string[];
  words?: Array<{
    word: string;
    start: number;
    end: number;
    speaker?: string;
    probability?: number;
  }>;
}

// Response from /run endpoint (async job submission)
interface IvritAsyncJobResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
}

// Response from /status/{jobId} endpoint
// Actual format: output[0].result[0] = array of segments
export interface IvritJobStatusResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  output?: Array<{
    result?: Array<Array<IvritOutputSegment>>;
  }>;
  error?: string;
  executionTime?: number;
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  // Retry on these status codes (server errors and rate limits)
  retryableStatusCodes: [429, 500, 502, 503, 504],
};

/**
 * Helper function to retry API calls with exponential backoff
 */
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable (contains status code in message)
      const isRetryable = RETRY_CONFIG.retryableStatusCodes.some(
        code => lastError!.message.includes(`${code}`)
      );

      if (!isRetryable || attempt === RETRY_CONFIG.maxRetries) {
        console.error(
          `${operationName} failed after ${attempt} attempt(s):`,
          lastError.message
        );
        throw lastError;
      }

      // Calculate delay with exponential backoff and jitter
      const baseDelay = RETRY_CONFIG.initialDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 1000;
      const delay = Math.min(baseDelay + jitter, RETRY_CONFIG.maxDelayMs);

      console.warn(
        `${operationName} failed (attempt ${attempt}/${RETRY_CONFIG.maxRetries}), ` +
        `retrying in ${Math.round(delay)}ms:`,
        lastError.message
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export class IvritProvider implements TranscriptionProvider {
  name = "ivrit";
  private apiKey: string;
  private endpointId: string;

  constructor(apiKey: string, endpointId: string) {
    this.apiKey = apiKey;
    this.endpointId = endpointId;
  }

  private get apiUrl(): string {
    return `https://api.runpod.ai/v2/${this.endpointId}/runsync`;
  }

  private get asyncApiUrl(): string {
    return `https://api.runpod.ai/v2/${this.endpointId}/run`;
  }

  private get statusApiUrl(): string {
    return `https://api.runpod.ai/v2/${this.endpointId}/status`;
  }

  async transcribe(
    audioBlob: Blob,
    options?: TranscriptionOptions
  ): Promise<TranscriptResult> {
    // Convert blob to base64
    const base64Audio = await this.blobToBase64(audioBlob);

    // Ivrit AI RunPod endpoint expects this specific format
    // See: https://github.com/ivrit-ai/runpod-serverless
    const requestBody = {
      input: {
        engine: "faster-whisper",
        model: "ivrit-ai/whisper-large-v3-turbo-ct2",
        transcribe_args: {
          blob: base64Audio,
          language: "he",
          diarize: true,
          num_speakers: options?.numSpeakers || 4,
        },
      },
    };

    const data = await withRetry(async () => {
      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ivrit API error: ${response.status} - ${error}`);
      }

      // runsync returns same format as status endpoint
      return await response.json() as IvritJobStatusResponse;
    }, "Ivrit transcribe");

    // Use shared parsing logic
    return this.parseJobOutput(data);
  }

  /**
   * Submit a transcription job asynchronously (returns immediately with job ID)
   * Supports either blob (for small files <10MB) or URL (for large files)
   * Includes retry logic for transient failures
   */
  async submitJob(
    audioBlobOrUrl: Blob | string,
    options?: TranscriptionOptions
  ): Promise<{ jobId: string }> {
    // Determine if input is URL or Blob
    const isUrl = typeof audioBlobOrUrl === "string";

    // Build transcribe_args based on input type
    // For large files, use URL to avoid RunPod's 10MB body limit
    const transcribe_args: Record<string, unknown> = {
      language: "he",
      diarize: true,
      num_speakers: options?.numSpeakers || 2,
    };

    if (isUrl) {
      transcribe_args.url = audioBlobOrUrl;
    } else {
      transcribe_args.blob = await this.blobToBase64(audioBlobOrUrl);
    }

    // Ivrit AI RunPod endpoint expects this specific format
    // See: https://github.com/ivrit-ai/runpod-serverless
    const requestBody = {
      input: {
        engine: "faster-whisper",
        model: "ivrit-ai/whisper-large-v3-turbo-ct2",
        transcribe_args,
      },
    };

    return withRetry(async () => {
      console.log("[Ivrit] Submitting job to:", this.asyncApiUrl);
      console.log("[Ivrit] Request:", { isUrl, hasPrompt: !!options?.prompt, numSpeakers: options?.numSpeakers });

      const response = await fetch(this.asyncApiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      console.log("[Ivrit] Response status:", response.status);

      if (!response.ok) {
        const error = await response.text();
        console.error("[Ivrit] API error:", { status: response.status, error });
        throw new Error(`Ivrit API error: ${response.status} - ${error}`);
      }

      const data: IvritAsyncJobResponse = await response.json();
      console.log("[Ivrit] Job created:", { jobId: data.id, status: data.status });
      return { jobId: data.id };
    }, "Ivrit submitJob");
  }

  /**
   * Check the status of an async transcription job
   * Includes retry logic for transient failures
   */
  async checkJobStatus(jobId: string): Promise<IvritJobStatusResponse> {
    return withRetry(async () => {
      const response = await fetch(`${this.statusApiUrl}/${jobId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ivrit status API error: ${response.status} - ${error}`);
      }

      return await response.json();
    }, `Ivrit checkJobStatus(${jobId})`);
  }

  /**
   * Parse completed job output into TranscriptResult
   * Actual RunPod format: output[0].result[0] = array of segments
   */
  parseJobOutput(jobStatus: IvritJobStatusResponse): TranscriptResult {
    if (jobStatus.status !== "COMPLETED") {
      throw new Error(`Job not completed: ${jobStatus.status}`);
    }

    if (jobStatus.error) {
      throw new Error(`Ivrit transcription error: ${jobStatus.error}`);
    }

    if (!jobStatus.output || !Array.isArray(jobStatus.output) || jobStatus.output.length === 0) {
      throw new Error("Ivrit API returned no output");
    }

    // Navigate to the actual segments: output[0].result[0]
    const firstOutput = jobStatus.output[0];
    if (!firstOutput.result || !Array.isArray(firstOutput.result) || firstOutput.result.length === 0) {
      throw new Error("Ivrit API returned no result in output");
    }

    const rawSegments = firstOutput.result[0];
    if (!Array.isArray(rawSegments) || rawSegments.length === 0) {
      throw new Error("Ivrit API returned empty segments");
    }

    // Parse segments with speaker diarization
    // Format: { text, start, end, speakers: ["SPEAKER_00"] }
    // Note: Model may output Hebrew names directly instead of "SPEAKER_00" format
    // Always normalize to generic "Speaker N" format to avoid hallucinated names
    const segments: TranscriptSegment[] = rawSegments.map((seg) => {
      // Extract speaker index from "SPEAKER_XX" format, or default to 1
      const speakerRaw = seg.speakers?.[0] || "";
      const speakerMatch = speakerRaw.match(/SPEAKER_(\d+)/i);
      const speakerIndex = speakerMatch ? parseInt(speakerMatch[1], 10) + 1 : 1;

      return {
        speaker: `Speaker ${speakerIndex}`,
        text: seg.text.trim(),
        start: seg.start,
        end: seg.end,
      };
    });

    const normalizedSegments = normalizeTranscriptSegments(segments);

    // Build full text from segments
    const fullText = normalizedSegments.map((s) => s.text).join(" ");

    // Calculate duration from last segment
    const duration = normalizedSegments.length > 0
      ? normalizedSegments[normalizedSegments.length - 1].end
      : 0;

    return {
      language: "he",
      segments: normalizedSegments,
      fullText,
      duration,
    };
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    return btoa(binary);
  }
}

export function createIvritProvider(): IvritProvider {
  const apiKey = process.env.IVRIT_API_KEY;
  const endpointId = process.env.IVRIT_ENDPOINT_ID;

  if (!apiKey) {
    throw new Error("IVRIT_API_KEY environment variable is not set");
  }
  if (!endpointId) {
    throw new Error("IVRIT_ENDPOINT_ID environment variable is not set");
  }

  return new IvritProvider(apiKey, endpointId);
}
