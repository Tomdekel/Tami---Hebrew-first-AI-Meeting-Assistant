import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  tokens: number;
}

export interface SemanticSearchResult {
  sessionId: string;
  sessionTitle: string;
  segmentText: string;
  similarity: number;
  speakerName: string | null;
  timestamp: number | null;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<EmbeddingResult> {
  const response = await getOpenAI().embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536,
  });

  return {
    text,
    embedding: response.data[0].embedding,
    tokens: response.usage.total_tokens,
  };
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(
  texts: string[]
): Promise<EmbeddingResult[]> {
  if (texts.length === 0) return [];

  // OpenAI supports up to 2048 inputs per request
  const batchSize = 100;
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);

    const response = await getOpenAI().embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
      dimensions: 1536,
    });

    for (let j = 0; j < batch.length; j++) {
      results.push({
        text: batch[j],
        embedding: response.data[j].embedding,
        tokens: Math.floor(response.usage.total_tokens / batch.length),
      });
    }
  }

  return results;
}

/**
 * Chunk transcript segments for embedding
 * Groups consecutive segments from same speaker, max ~500 tokens per chunk
 */
export function chunkTranscriptForEmbedding(
  segments: Array<{
    speakerId: string;
    speakerName?: string | null;
    text: string;
    startTime?: number | null;
  }>
): Array<{
  text: string;
  speakerId: string;
  speakerName: string | null;
  startTime: number | null;
  segmentIndices: number[];
}> {
  const chunks: Array<{
    text: string;
    speakerId: string;
    speakerName: string | null;
    startTime: number | null;
    segmentIndices: number[];
  }> = [];

  let currentChunk: {
    texts: string[];
    speakerId: string;
    speakerName: string | null;
    startTime: number | null;
    segmentIndices: number[];
  } | null = null;

  const MAX_CHUNK_LENGTH = 2000; // ~500 tokens

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentText = segment.text.trim();

    if (!segmentText) continue;

    // Start new chunk if speaker changes or chunk is too long
    const shouldStartNew =
      !currentChunk ||
      currentChunk.speakerName !== (segment.speakerName || segment.speakerId) ||
      currentChunk.texts.join(" ").length + segmentText.length > MAX_CHUNK_LENGTH;

    if (shouldStartNew) {
      if (currentChunk && currentChunk.texts.length > 0) {
        chunks.push({
          text: currentChunk.texts.join(" "),
          speakerId: currentChunk.speakerId,
          speakerName: currentChunk.speakerName,
          startTime: currentChunk.startTime,
          segmentIndices: currentChunk.segmentIndices,
        });
      }
      currentChunk = {
        texts: [segmentText],
        speakerId: segment.speakerId,
        speakerName: segment.speakerName || segment.speakerId,
        startTime: segment.startTime ?? null,
        segmentIndices: [i],
      };
    } else if (currentChunk) {
      currentChunk.texts.push(segmentText);
      currentChunk.segmentIndices.push(i);
    }
  }

  // Add final chunk
  if (currentChunk && currentChunk.texts.length > 0) {
    chunks.push({
      text: currentChunk.texts.join(" "),
      speakerId: currentChunk.speakerId,
      speakerName: currentChunk.speakerName,
      startTime: currentChunk.startTime,
      segmentIndices: currentChunk.segmentIndices,
    });
  }

  return chunks;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
