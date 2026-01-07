"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export type RecordingMode = "microphone" | "system";
export type RecordingState = "idle" | "requesting" | "recording" | "paused" | "stopped";

export interface RecordingOptions {
  mode: RecordingMode;
  onChunk?: (chunk: Blob, index: number) => void;
  onError?: (error: Error) => void;
  chunkInterval?: number; // milliseconds, default 30000 (30 seconds)
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
}

export function useRecording(options: RecordingOptions): UseRecordingReturn {
  const { mode, onChunk, onError, chunkInterval = 30000 } = options;

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

  // Update duration every second while recording
  useEffect(() => {
    if (state === "recording") {
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current + pausedDurationRef.current;
        setDuration(Math.floor(elapsed / 1000));
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
  }, [state]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

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
      chunksRef.current = [];
      chunkIndexRef.current = 0;
      pausedDurationRef.current = 0;

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
          if (onChunk) {
            onChunk(event.data, chunkIndexRef.current++);
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
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      startTimeRef.current = Date.now();
      setState("recording");
    }
  }, []);

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
  };
}
