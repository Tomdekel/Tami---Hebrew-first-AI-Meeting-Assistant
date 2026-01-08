"use client";

import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface IdleWaveformProps {
  className?: string;
  barColor?: string;
  backgroundColor?: string;
}

export function IdleWaveform({
  className,
  barColor = "#6b7280", // gray-500 for idle state
  backgroundColor = "#1f2937", // gray-800
}: IdleWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const timeRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const barCount = 64;
    const barWidth = width / barCount;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw gentle sine wave animation
    const time = timeRef.current;
    let x = 0;

    for (let i = 0; i < barCount; i++) {
      // Create a gentle wave pattern using multiple sine waves
      const wave1 = Math.sin((i / barCount) * Math.PI * 2 + time * 0.02) * 0.3;
      const wave2 = Math.sin((i / barCount) * Math.PI * 4 + time * 0.015) * 0.15;
      const wave3 = Math.sin((i / barCount) * Math.PI * 6 + time * 0.025) * 0.1;

      // Combine waves and add base height
      const normalizedHeight = 0.15 + Math.abs(wave1 + wave2 + wave3);
      const barHeight = normalizedHeight * height * 0.6;

      // Draw bar (centered vertically)
      ctx.fillStyle = barColor;
      const y = (height - barHeight) / 2;
      ctx.fillRect(x, y, barWidth - 1, barHeight);

      x += barWidth;
    }

    timeRef.current += 1;
    animationIdRef.current = requestAnimationFrame(draw);
  }, [barColor, backgroundColor]);

  useEffect(() => {
    draw();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [draw]);

  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        width={400}
        height={100}
        className="w-full h-full rounded-lg opacity-50"
        style={{ backgroundColor }}
      />
    </div>
  );
}
