"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingMode = "microphone" | "system";
export type RecordingState = "idle" | "requesting" | "recording" | "paused" | "stopped";
export type DurationWarningLevel = "soft" | "strong" | "final";
export type AutoEndReason = "pause_timeout" | "page_exit" | "max_duration";

// Default warning thresholds in seconds
const DEFAULT_SOFT_WARNING = 60 * 60; // 1 hour
const DEFAULT_STRONG_WARNING = 90 * 60; // 1.5 hours
const DEFAULT_MAX_DURATION = 120 * 60; // 2 hours
const DEFAULT_PAUSE_TIMEOUT = 60 * 60 * 1000; // 1 hour in milliseconds

export interface DurationWarning {
  level: DurationWarningLevel;
  remainingSeconds: number;
  message: string;
}

export interface RecordingOptions {
  mode: RecordingMode;
  onChunk?: (chunk: Blob, index: number) => void;
  onError?: (error: Error) => void;
  onDurationWarning?: (warning: DurationWarning) => void;
  onAutoEnd?: (reason: AutoEndReason) => void;
  chunkInterval?: number; // milliseconds, default 30000 (30 seconds)
  softWarningAt?: number; // seconds, default 3600 (1 hour)
  strongWarningAt?: number; // seconds, default 5400 (1.5 hours)
  maxDuration?: number; // seconds, default 7200 (2 hours), 0 to disable
  pauseTimeout?: number; // milliseconds, default 3600000 (1 hour), 0 to disable
}

export interface UseRecordingReturn {
  state: RecordingState;
  duration: number;
  error: Error | null;
  audioBlob: Blob | null;
  stream: MediaStream | null;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
}

export function useRecording(options: RecordingOptions): UseRecordingReturn {
  const {
    mode,
    onChunk,
    onError,
    onDurationWarning,
    onAutoEnd,
    chunkInterval = 30000,
    softWarningAt = DEFAULT_SOFT_WARNING,
    strongWarningAt = DEFAULT_STRONG_WARNING,
    maxDuration = DEFAULT_MAX_DURATION,
    pauseTimeout = DEFAULT_PAUSE_TIMEOUT,
  } = options;

  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const chunkIndexRef = useRef(0);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const softWarningShownRef = useRef(false);
  const strongWarningShownRef = useRef(false);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef<RecordingState>("idle");

  // Update duration every second while recording + check for warnings
  useEffect(() => {
    if (state === "recording") {
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current + pausedDurationRef.current;
        const currentDuration = Math.floor(elapsed / 1000);
        setDuration(currentDuration);

        // Check for auto-stop at max duration
        if (maxDuration > 0 && currentDuration >= maxDuration) {
          if (onDurationWarning) {
            onDurationWarning({
              level: "final",
              remainingSeconds: 0,
              message: "Maximum recording duration reached. Recording stopped automatically.",
            });
          }
          // Auto-stop the recording
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
          return;
        }

        // Check for strong warning (1.5 hours)
        if (
          strongWarningAt > 0 &&
          currentDuration >= strongWarningAt &&
          !strongWarningShownRef.current
        ) {
          strongWarningShownRef.current = true;
          if (onDurationWarning) {
            const remaining = maxDuration - currentDuration;
            onDurationWarning({
              level: "strong",
              remainingSeconds: remaining,
              message: `Recording will stop in ${Math.round(remaining / 60)} minutes. Please wrap up soon.`,
            });
          }
        }
        // Check for soft warning (1 hour)
        else if (
          softWarningAt > 0 &&
          currentDuration >= softWarningAt &&
          !softWarningShownRef.current
        ) {
          softWarningShownRef.current = true;
          if (onDurationWarning) {
            const remaining = maxDuration - currentDuration;
            onDurationWarning({
              level: "soft",
              remainingSeconds: remaining,
              message: `You've been recording for 1 hour. ${Math.round(remaining / 60)} minutes remaining.`,
            });
          }
        }
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [state, softWarningAt, strongWarningAt, maxDuration, onDurationWarning]);

  // Keep stateRef in sync with state for use in event handlers
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Cleanup on unmount only - empty dependency array ensures this only runs on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  // Handle beforeunload - warn user if recording is active
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (stateRef.current === "recording" || stateRef.current === "paused") {
        e.preventDefault();
        // Modern browsers ignore custom messages, but we need to set returnValue
        e.returnValue = "";
        return "";
      }
    };

    const handleUnload = () => {
      if (stateRef.current === "recording" || stateRef.current === "paused") {
        onAutoEnd?.("page_exit");
        // Force stop to save recording
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("unload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("unload", handleUnload);
    };
  }, [onAutoEnd]);

  const getMicrophoneStream = async (): Promise<MediaStream> => {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
      },
    });
  };

  const getSystemAudioStream = async (): Promise<MediaStream> => {
    // Request screen share with audio
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true, // Required, but we'll discard it
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 16000,
      },
    });

    // Extract audio tracks
    const audioTracks = displayStream.getAudioTracks();
    const videoTracks = displayStream.getVideoTracks();

    // Stop video tracks to save resources
    videoTracks.forEach((track) => track.stop());

    if (audioTracks.length === 0) {
      throw new Error(
        'No audio captured. Make sure to check "Share audio" when sharing your screen.'
      );
    }

    return new MediaStream(audioTracks);
  };

  const start = useCallback(async () => {
    try {
      setState("requesting");
      setError(null);
      setAudioBlob(null);
      setDuration(0);
      chunksRef.current = [];
      chunkIndexRef.current = 0;
      pausedDurationRef.current = 0;
      softWarningShownRef.current = false;
      strongWarningShownRef.current = false;

      // Get the appropriate stream based on mode
      const audioStream =
        mode === "microphone"
          ? await getMicrophoneStream()
          : await getSystemAudioStream();

      setStream(audioStream);

      // Determine supported MIME type
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);

          // Call onChunk callback for progressive upload
          // Wrapped in try-catch to prevent callback errors from crashing recording
          if (onChunk) {
            try {
              onChunk(event.data, chunkIndexRef.current++);
            } catch (err) {
              console.error("Chunk upload callback error:", err);
              // Continue recording - chunk is saved locally in chunksRef
              // so it will be included in the final blob even if upload fails
            }
          }
        }
      };

      mediaRecorder.onstop = () => {
        // Combine all chunks into final blob
        const finalBlob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(finalBlob);
        setState("stopped");

        // Stop all tracks
        audioStream.getTracks().forEach((track) => track.stop());
        setStream(null);
      };

      mediaRecorder.onerror = (event) => {
        const err = new Error(`Recording error: ${event.type}`);
        setError(err);
        if (onError) onError(err);
        setState("idle");
      };

      // Start recording with chunked data
      mediaRecorder.start(chunkInterval);
      startTimeRef.current = Date.now();
      setState("recording");
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      if (onError) onError(error);
      setState("idle");
    }
  }, [mode, chunkInterval, onChunk, onError]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      pausedDurationRef.current += Date.now() - startTimeRef.current;
      setState("paused");

      // Set auto-end timeout for extended pause
      if (pauseTimeout > 0) {
        pauseTimeoutRef.current = setTimeout(() => {
          onAutoEnd?.("pause_timeout");
          // Stop the recording after pause timeout
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        }, pauseTimeout);
      }
    }
  }, [pauseTimeout, onAutoEnd]);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      // Clear pause timeout
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
        pauseTimeoutRef.current = null;
      }

      mediaRecorderRef.current.resume();
      startTimeRef.current = Date.now();
      setState("recording");
    }
  }, []);

  const reset = useCallback(() => {
    // Stop any active recording
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    // Stop any active stream
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    // Clear pause timeout
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }
    // Reset all state
    setAudioBlob(null);
    setError(null);
    setDuration(0);
    setState("idle");
    setStream(null);
    chunksRef.current = [];
    chunkIndexRef.current = 0;
    pausedDurationRef.current = 0;
    softWarningShownRef.current = false;
    strongWarningShownRef.current = false;
  }, [stream]);

  return {
    state,
    duration,
    error,
    audioBlob,
    stream,
    start,
    stop,
    pause,
    resume,
    reset,
  };
}
