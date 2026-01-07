"use client";

import { cn } from "@/lib/utils";

interface RecordingTimerProps {
  duration: number; // in seconds
  isRecording: boolean;
  className?: string;
}

export function RecordingTimer({
  duration,
  isRecording,
  className,
}: RecordingTimerProps) {
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = duration % 60;

  const formatTime = (value: number) => value.toString().padStart(2, "0");

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {isRecording && (
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
        </span>
      )}
      <span className="font-mono text-2xl tabular-nums">
        {hours > 0 && `${formatTime(hours)}:`}
        {formatTime(minutes)}:{formatTime(seconds)}
      </span>
    </div>
  );
}
