"use client";

import { cn } from "@/lib/utils";

interface RecordingTimerProps {
  duration: number; // in seconds
  isRecording: boolean;
  isPaused?: boolean;
  className?: string;
}

export function RecordingTimer({
  duration,
  isRecording,
  isPaused = false,
  className,
}: RecordingTimerProps) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;

  const formatTime = (value: number) => value.toString().padStart(2, "0");

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {(isRecording || isPaused) && (
        <span className="relative flex h-3 w-3">
          {isPaused ? (
            // Yellow indicator when paused
            <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-500" />
          ) : (
            // Red pulsing indicator when recording
            <>
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </>
          )}
        </span>
      )}
      <span className="font-mono text-2xl tabular-nums">
        {hours > 0 && `${formatTime(hours)}:`}
        {formatTime(minutes)}:{formatTime(seconds)}
      </span>
      {isPaused && (
        <span className="text-sm text-yellow-600 font-medium">⏸</span>
      )}
    </div>
  );
}
