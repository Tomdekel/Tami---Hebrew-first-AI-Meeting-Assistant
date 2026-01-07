"use client";

import { useWaveform } from "@/hooks/use-waveform";
import { cn } from "@/lib/utils";

interface WaveformProps {
  stream: MediaStream | null;
  className?: string;
  barColor?: string;
  backgroundColor?: string;
}

export function Waveform({
  stream,
  className,
  barColor = "#3b82f6",
  backgroundColor = "#1f2937",
}: WaveformProps) {
  const { canvasRef, isActive, audioLevel } = useWaveform({
    stream,
    barColor,
    backgroundColor,
  });

  return (
    <div className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        width={400}
        height={100}
        className="w-full h-full rounded-lg"
        style={{ backgroundColor }}
      />
      {isActive && (
        <div className="absolute bottom-2 end-2 text-xs text-white/60">
          {audioLevel}%
        </div>
      )}
    </div>
  );
}
