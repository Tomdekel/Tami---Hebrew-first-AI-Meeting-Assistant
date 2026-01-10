import { PassThrough } from "node:stream";
import type { AudioCaptureConfig, AudioCaptureHandle } from "../types";

/**
 * Create an in-memory audio capture handle (placeholder stream).
 */
export function createInMemoryAudioCapture(config: AudioCaptureConfig): AudioCaptureHandle {
  const stream = new PassThrough();
  return {
    id: `audio_${Math.random().toString(36).slice(2)}`,
    startedAt: new Date().toISOString(),
    format: config.format,
    stream,
    stop: async () => {
      stream.end();
    },
  };
}

/**
 * Create a no-op audio capture handle.
 */
export function createNoopAudioCapture(config: AudioCaptureConfig): AudioCaptureHandle {
  return {
    id: `audio_${Math.random().toString(36).slice(2)}`,
    startedAt: new Date().toISOString(),
    format: config.format,
    stop: async () => undefined,
  };
}
