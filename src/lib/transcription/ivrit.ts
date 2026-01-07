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
