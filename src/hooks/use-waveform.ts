"use client";

import { useRef, useEffect, useCallback, useState } from "react";

export interface UseWaveformOptions {
  stream: MediaStream | null;
  fftSize?: number;
  barCount?: number;
  barColor?: string;
  backgroundColor?: string;
}

export interface UseWaveformReturn {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  isActive: boolean;
  audioLevel: number; // 0-100, useful for visual feedback
}

export function useWaveform(options: UseWaveformOptions): UseWaveformReturn {
  const {
    stream,
    fftSize = 256,
    barCount = 64,
    barColor = "#3b82f6", // blue-500
    backgroundColor = "#1f2937", // gray-800
  } = options;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;

    if (!canvas || !analyser) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Calculate bar width based on desired bar count
    const barWidth = width / barCount;
    const step = Math.floor(dataArray.length / barCount);

    let x = 0;
    let totalLevel = 0;

    for (let i = 0; i < barCount; i++) {
      // Average the frequency data for this bar
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j] || 0;
      }
      const barHeight = (sum / step / 255) * height;
      totalLevel += sum / step;

      // Draw bar (centered vertically)
      ctx.fillStyle = barColor;
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, barWidth - 1, barHeight);

      x += barWidth;
    }

    // Calculate average audio level (0-100)
    const avgLevel = Math.min(100, Math.round((totalLevel / barCount / 255) * 100 * 2));
    setAudioLevel(avgLevel);

    // Continue animation
    animationIdRef.current = requestAnimationFrame(draw);
  }, [barCount, barColor, backgroundColor]);

  useEffect(() => {
    if (!stream) {
      // Cleanup when stream is removed
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
      setIsActive(false);
      setAudioLevel(0);
      return;
    }

    // Create audio context and analyser
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = fftSize;

    // Connect stream to analyser
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    setIsActive(true);

    // Start drawing
    draw();

    // Cleanup
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream, fftSize, draw]);

  return {
    canvasRef,
    isActive,
    audioLevel,
  };
}
