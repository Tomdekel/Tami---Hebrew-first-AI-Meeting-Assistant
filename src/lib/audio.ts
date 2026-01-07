import { createClient } from "@/lib/supabase/client";

const AUDIO_BUCKET = "audio";

export interface UploadResult {
  path: string;
  url: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

/**
 * Upload a single audio blob to Supabase Storage
 */
export async function uploadAudioBlob(
  blob: Blob,
  userId: string,
  sessionId: string,
  fileName?: string
): Promise<UploadResult> {
  const supabase = createClient();

  // Generate file name if not provided
  const name = fileName || `recording_${Date.now()}.webm`;
  const path = `${userId}/${sessionId}/${name}`;

  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || "audio/webm",
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  // Get public URL (or signed URL for private buckets)
  const { data: urlData } = supabase.storage
    .from(AUDIO_BUCKET)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Upload an audio chunk (for progressive backup during recording)
 */
export async function uploadAudioChunk(
  chunk: Blob,
  userId: string,
  sessionId: string,
  chunkIndex: number
): Promise<UploadResult> {
  const supabase = createClient();

  const path = `${userId}/${sessionId}/chunks/chunk_${chunkIndex.toString().padStart(4, "0")}.webm`;

  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(path, chunk, {
      contentType: chunk.type || "audio/webm",
      upsert: true, // Allow overwriting in case of retry
    });

  if (error) {
    throw new Error(`Chunk upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(AUDIO_BUCKET)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Combine audio chunks into a single file
 */
export async function combineAudioChunks(
  userId: string,
  sessionId: string,
  chunkCount: number
): Promise<UploadResult> {
  const supabase = createClient();

  // Download all chunks
  const chunks: Blob[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const chunkPath = `${userId}/${sessionId}/chunks/chunk_${i.toString().padStart(4, "0")}.webm`;

    const { data, error } = await supabase.storage
      .from(AUDIO_BUCKET)
      .download(chunkPath);

    if (error) {
      throw new Error(`Failed to download chunk ${i}: ${error.message}`);
    }

    chunks.push(data);
  }

  // Combine chunks
  const combinedBlob = new Blob(chunks, { type: "audio/webm" });

  // Upload combined file
  const finalPath = `${userId}/${sessionId}/recording.webm`;

  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .upload(finalPath, combinedBlob, {
      contentType: "audio/webm",
      upsert: true,
    });

  if (error) {
    throw new Error(`Combined upload failed: ${error.message}`);
  }

  const { data: urlData } = supabase.storage
    .from(AUDIO_BUCKET)
    .getPublicUrl(data.path);

  return {
    path: data.path,
    url: urlData.publicUrl,
  };
}

/**
 * Delete audio chunks after combining
 */
export async function deleteAudioChunks(
  userId: string,
  sessionId: string,
  chunkCount: number
): Promise<void> {
  const supabase = createClient();

  const paths: string[] = [];
  for (let i = 0; i < chunkCount; i++) {
    paths.push(`${userId}/${sessionId}/chunks/chunk_${i.toString().padStart(4, "0")}.webm`);
  }

  const { error } = await supabase.storage.from(AUDIO_BUCKET).remove(paths);

  if (error) {
    console.error("Failed to delete chunks:", error);
    // Don't throw - cleanup failure shouldn't break the flow
  }
}

/**
 * Get signed URL for private audio file
 */
export async function getSignedAudioUrl(
  path: string,
  expiresIn: number = 3600 // 1 hour
): Promise<string> {
  const supabase = createClient();

  const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(`Failed to get signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Delete an audio file
 */
export async function deleteAudioFile(path: string): Promise<void> {
  const supabase = createClient();

  const { error } = await supabase.storage.from(AUDIO_BUCKET).remove([path]);

  if (error) {
    throw new Error(`Delete failed: ${error.message}`);
  }
}

/**
 * Convert blob to base64 (for API calls)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix (e.g., "data:audio/webm;base64,")
      const base64Data = base64.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Extract a sample from an audio blob (for language detection)
 */
export async function extractAudioSample(
  blob: Blob,
  durationSeconds: number = 10
): Promise<Blob> {
  // For WebM/Opus, we can't easily extract a sample without decoding
  // So for now, we'll just return the full blob if it's short enough
  // or the first part of it

  // Rough estimate: 128kbps = 16KB/s
  const estimatedBytesPerSecond = 16000;
  const targetBytes = durationSeconds * estimatedBytesPerSecond;

  if (blob.size <= targetBytes) {
    return blob;
  }

  // Return first N bytes (this is approximate and may not play correctly)
  // For production, use Web Audio API to properly slice the audio
  return blob.slice(0, targetBytes, blob.type);
}
