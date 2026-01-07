"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Mic, Square, Pause, Play, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useRecording, type RecordingMode } from "@/hooks/use-recording";
import { ModeSelector } from "./mode-selector";
import { RecordingTimer } from "./recording-timer";
import { Waveform } from "./waveform";
import { cn } from "@/lib/utils";

interface RecorderProps {
  onRecordingComplete?: (blob: Blob) => void;
  onChunk?: (chunk: Blob, index: number) => void;
  className?: string;
}

export function Recorder({
  onRecordingComplete,
  onChunk,
  className,
}: RecorderProps) {
  const t = useTranslations();
  const [mode, setMode] = useState<RecordingMode | null>(null);

  const {
    state,
    duration,
    error,
    audioBlob,
    stream,
    start,
    stop,
    pause,
    resume,
  } = useRecording({
    mode: mode || "microphone",
    onChunk,
    onError: (err) => console.error("Recording error:", err),
  });

  const handleStart = useCallback(async () => {
    if (!mode) return;
    await start();
  }, [mode, start]);

  const handleStop = useCallback(() => {
    stop();
  }, [stop]);

  // Call onRecordingComplete when recording finishes
  if (audioBlob && state === "stopped" && onRecordingComplete) {
    // Use setTimeout to avoid calling during render
    setTimeout(() => onRecordingComplete(audioBlob), 0);
  }

  const isIdle = state === "idle" || state === "stopped";
  const isRecording = state === "recording";
  const isPaused = state === "paused";
  const isRequesting = state === "requesting";

  return (
    <div className={cn("space-y-6", className)}>
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t("common.error")}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* System Audio Warning */}
      {mode === "system" && isIdle && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Important</AlertTitle>
          <AlertDescription>{t("recording.shareAudioWarning")}</AlertDescription>
        </Alert>
      )}

      {/* Mode Selection - Only show when idle */}
      {isIdle && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium">{t("recording.selectMode")}</h3>
          <ModeSelector
            selectedMode={mode}
            onSelectMode={setMode}
            disabled={!isIdle}
          />
        </div>
      )}

      {/* Recording Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-6">
            {/* Waveform */}
            {(isRecording || isPaused) && (
              <Waveform
                stream={stream}
                className="w-full h-24"
                barColor={isPaused ? "#6b7280" : "#3b82f6"}
              />
            )}

            {/* Timer */}
            <RecordingTimer
              duration={duration}
              isRecording={isRecording}
            />

            {/* Controls */}
            <div className="flex items-center gap-4">
              {isIdle && (
                <Button
                  size="lg"
                  onClick={handleStart}
                  disabled={!mode || isRequesting}
                  className="gap-2"
                >
                  {isRequesting ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                  {t("recording.start")}
                </Button>
              )}

              {isRecording && (
                <>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={pause}
                    className="gap-2"
                  >
                    <Pause className="h-5 w-5" />
                    {t("recording.pause")}
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleStop}
                    className="gap-2"
                  >
                    <Square className="h-5 w-5" />
                    {t("recording.stop")}
                  </Button>
                </>
              )}

              {isPaused && (
                <>
                  <Button
                    size="lg"
                    onClick={resume}
                    className="gap-2"
                  >
                    <Play className="h-5 w-5" />
                    {t("recording.resume")}
                  </Button>
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleStop}
                    className="gap-2"
                  >
                    <Square className="h-5 w-5" />
                    {t("recording.stop")}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audio Preview - Show when stopped */}
      {audioBlob && state === "stopped" && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <h3 className="font-medium">Recording Preview</h3>
              <audio
                controls
                src={URL.createObjectURL(audioBlob)}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                Duration: {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")} •
                Size: {(audioBlob.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
