import type { TranscriptResult, TranscriptionOptions, TranscriptionProvider, TranscriptSegment } from "./types";

interface IvritSegment {
  start: number;
  end: number;
  text: string;
  speaker?: string;
}

interface IvritResponse {
  output?: {
    transcription?: string;
    segments?: IvritSegment[];
    language?: string;
    duration?: number;
  };
  status?: string;
  error?: string;
}

// Response from /run endpoint (async job submission)
interface IvritAsyncJobResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
}

// Response from /status/{jobId} endpoint
export interface IvritJobStatusResponse {
  id: string;
  status: "IN_QUEUE" | "IN_PROGRESS" | "COMPLETED" | "FAILED" | "CANCELLED";
  output?: {
    transcription?: string;
    segments?: IvritSegment[];
    language?: string;
    duration?: number;
  };
  error?: string;
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

    const requestBody = {
      input: {
        audio_base64: base64Audio,
        language: "he",
        task: "transcribe",
        diarize: true,
        num_speakers: options?.numSpeakers || 10,
      },
    };

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

    const data: IvritResponse = await response.json();

    if (data.error) {
      throw new Error(`Ivrit transcription error: ${data.error}`);
    }

    if (!data.output) {
      throw new Error("Ivrit API returned no output");
    }

    // Parse segments with speaker diarization
    const segments: TranscriptSegment[] = data.output.segments?.map((seg) => ({
      speaker: seg.speaker || "Speaker 1",
      text: seg.text.trim(),
      start: seg.start,
      end: seg.end,
    })) || [{
      speaker: "Speaker 1",
      text: data.output.transcription?.trim() || "",
      start: 0,
      end: data.output.duration || 0,
    }];

    // Build full text from segments
    const fullText = segments.map((s) => s.text).join(" ");

    return {
      language: "he",
      segments,
      fullText,
      duration: data.output.duration || 0,
    };
  }

  /**
   * Submit a transcription job asynchronously (returns immediately with job ID)
   */
  async submitJob(
    audioBlob: Blob,
    options?: TranscriptionOptions
  ): Promise<{ jobId: string }> {
    const base64Audio = await this.blobToBase64(audioBlob);

    const requestBody = {
      input: {
        audio_base64: base64Audio,
        language: "he",
        task: "transcribe",
        diarize: true,
        num_speakers: options?.numSpeakers || 10,
      },
    };

    const response = await fetch(this.asyncApiUrl, {
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

    const data: IvritAsyncJobResponse = await response.json();
    return { jobId: data.id };
  }

  /**
   * Check the status of an async transcription job
   */
  async checkJobStatus(jobId: string): Promise<IvritJobStatusResponse> {
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
  }

  /**
   * Parse completed job output into TranscriptResult
   */
  parseJobOutput(jobStatus: IvritJobStatusResponse): TranscriptResult {
    if (jobStatus.status !== "COMPLETED") {
      throw new Error(`Job not completed: ${jobStatus.status}`);
    }

    if (jobStatus.error) {
      throw new Error(`Ivrit transcription error: ${jobStatus.error}`);
    }

    if (!jobStatus.output) {
      throw new Error("Ivrit API returned no output");
    }

    // Parse segments with speaker diarization
    const segments: TranscriptSegment[] = jobStatus.output.segments?.map((seg) => ({
      speaker: seg.speaker || "Speaker 1",
      text: seg.text.trim(),
      start: seg.start,
      end: seg.end,
    })) || [{
      speaker: "Speaker 1",
      text: jobStatus.output.transcription?.trim() || "",
      start: 0,
      end: jobStatus.output.duration || 0,
    }];

    // Build full text from segments
    const fullText = segments.map((s) => s.text).join(" ");

    return {
      language: "he",
      segments,
      fullText,
      duration: jobStatus.output.duration || 0,
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
