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

// ============================================================================
// Audio Validation
// ============================================================================

export interface AudioValidationResult {
  isValid: boolean;
  error?: string;
  details: {
    duration: number; // seconds
    avgAmplitude: number; // 0-1
    peakAmplitude: number; // 0-1
    silenceRatio: number; // 0-1 (percentage of audio that is silence)
    hasLikelySpeech: boolean;
  };
}

// Minimum thresholds for valid audio
const MIN_DURATION_SECONDS = 1;
const MAX_DURATION_SECONDS = 7200; // 2 hours
const MIN_AVERAGE_AMPLITUDE = 0.005; // Very quiet audio threshold
const MIN_PEAK_AMPLITUDE = 0.02; // At least some audible content
const MAX_SILENCE_RATIO = 0.95; // If 95%+ is silence, likely no speech
const SILENCE_THRESHOLD = 0.01; // Below this is considered silence

/**
 * Validate an audio blob for speech content
 * Uses Web Audio API to analyze the audio
 */
export async function validateAudioForSpeech(
  audioBlob: Blob
): Promise<AudioValidationResult> {
  try {
    // WebM/Opus files from MediaRecorder often cannot be decoded by Web Audio API
    // Skip validation for these formats and trust the recording
    const isWebM = audioBlob.type.includes("webm") || audioBlob.type.includes("opus");

    if (isWebM) {
      // For WebM/Opus from MediaRecorder, we can't easily validate
      // Just check basic size/duration constraints
      // WebM files have headers even when very short, so check for minimum content
      const minSizeBytes = 1000; // 1KB minimum - just needs some audio data

      if (audioBlob.size < minSizeBytes) {
        return {
          isValid: false,
          error: "Recording is too short. Please record at least a few seconds of audio.",
          details: {
            duration: 0,
            avgAmplitude: 0,
            peakAmplitude: 0,
            silenceRatio: 0,
            hasLikelySpeech: true,
          },
        };
      }

      // Estimate duration from file size (very rough: ~16KB/sec for 128kbps)
      const estimatedDuration = audioBlob.size / 16000;

      if (estimatedDuration > MAX_DURATION_SECONDS) {
        return {
          isValid: false,
          error: "Audio is too long. Maximum duration is 2 hours.",
          details: {
            duration: estimatedDuration,
            avgAmplitude: 0,
            peakAmplitude: 0,
            silenceRatio: 0,
            hasLikelySpeech: true,
          },
        };
      }

      // For WebM, assume it's valid and let the transcription service handle it
      return {
        isValid: true,
        details: {
          duration: estimatedDuration,
          avgAmplitude: 0.5, // Unknown, assume valid
          peakAmplitude: 0.5, // Unknown, assume valid
          silenceRatio: 0, // Unknown, assume valid
          hasLikelySpeech: true, // Assume true for WebM
        },
      };
    }

    // For non-WebM formats (MP3, WAV, M4A), use Web Audio API validation
    // Convert blob to array buffer
    const arrayBuffer = await audioBlob.arrayBuffer();

    // Create audio context and decode
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioContextClass();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Get audio data from first channel
    const channelData = audioBuffer.getChannelData(0);
    const duration = audioBuffer.duration;

    // Analyze audio levels
    let sum = 0;
    let peak = 0;
    let silentSamples = 0;

    for (let i = 0; i < channelData.length; i++) {
      const amplitude = Math.abs(channelData[i]);
      sum += amplitude;
      if (amplitude > peak) peak = amplitude;
      if (amplitude < SILENCE_THRESHOLD) silentSamples++;
    }

    const avgAmplitude = sum / channelData.length;
    const silenceRatio = silentSamples / channelData.length;

    // Determine if likely has speech (simple heuristic)
    const hasLikelySpeech =
      avgAmplitude > MIN_AVERAGE_AMPLITUDE &&
      peak > MIN_PEAK_AMPLITUDE &&
      silenceRatio < MAX_SILENCE_RATIO;

    const details = {
      duration,
      avgAmplitude,
      peakAmplitude: peak,
      silenceRatio,
      hasLikelySpeech,
    };

    // Close audio context
    await audioContext.close();

    // Validate duration
    if (duration < MIN_DURATION_SECONDS) {
      return {
        isValid: false,
        error: "Audio is too short. Please record at least 1 second of audio.",
        details,
      };
    }

    if (duration > MAX_DURATION_SECONDS) {
      return {
        isValid: false,
        error: "Audio is too long. Maximum duration is 2 hours.",
        details,
      };
    }

    // Validate content
    if (peak < MIN_PEAK_AMPLITUDE) {
      return {
        isValid: false,
        error: "Audio appears to be completely silent or very quiet. Please check your microphone settings.",
        details,
      };
    }

    if (avgAmplitude < MIN_AVERAGE_AMPLITUDE) {
      return {
        isValid: false,
        error: "Audio levels are too low. The recording may be mostly silence.",
        details,
      };
    }

    if (silenceRatio > MAX_SILENCE_RATIO) {
      return {
        isValid: false,
        error: "The recording contains mostly silence with very little speech detected.",
        details,
      };
    }

    if (!hasLikelySpeech) {
      return {
        isValid: false,
        error: "No speech detected in the audio. Please ensure the recording contains audible speech.",
        details,
      };
    }

    return {
      isValid: true,
      details,
    };
  } catch (error) {
    return {
      isValid: false,
      error: `Failed to analyze audio: ${error instanceof Error ? error.message : "Unknown error"}`,
      details: {
        duration: 0,
        avgAmplitude: 0,
        peakAmplitude: 0,
        silenceRatio: 1,
        hasLikelySpeech: false,
      },
    };
  }
}

/**
 * Format validation details for display
 */
export function formatValidationDetails(details: AudioValidationResult["details"]): string {
  const duration = Math.round(details.duration);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const durationStr = minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`;

  const silencePercent = Math.round(details.silenceRatio * 100);
  const avgDb = details.avgAmplitude > 0
    ? Math.round(20 * Math.log10(details.avgAmplitude))
    : -100;

  return `Duration: ${durationStr} | Silence: ${silencePercent}% | Avg level: ${avgDb}dB`;
}
