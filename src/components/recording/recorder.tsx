"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Mic, Square, Pause, Play, AlertCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { useRecording, type RecordingMode, type DurationWarning } from "@/hooks/use-recording";
import { ModeSelector } from "./mode-selector";
import { RecordingTimer } from "./recording-timer";
import { Waveform } from "./waveform";
import { IdleWaveform } from "./idle-waveform";
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
  const completedRef = useRef(false);

  // Handle duration warnings with toasts
  const handleDurationWarning = useCallback((warning: DurationWarning) => {
    const toastOptions = {
      duration: warning.level === "final" ? 10000 : 8000,
      icon: <Clock className="h-5 w-5" />,
    };

    switch (warning.level) {
      case "soft":
        toast.info("Recording Time Reminder", {
          description: warning.message,
          ...toastOptions,
        });
        break;
      case "strong":
        toast.warning("Recording Ending Soon", {
          description: warning.message,
          ...toastOptions,
        });
        break;
      case "final":
        toast.error("Recording Stopped", {
          description: warning.message,
          ...toastOptions,
        });
        break;
    }
  }, []);

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
    reset,
  } = useRecording({
    mode: mode || "microphone",
    onChunk,
    onError: (err) => console.error("Recording error:", err),
    onDurationWarning: handleDurationWarning,
  });

  const handleStart = useCallback(async () => {
    if (!mode) return;
    completedRef.current = false; // Reset when starting new recording
    await start();
  }, [mode, start]);

  const handleStop = useCallback(() => {
    // Require at least 2 seconds of recording
    if (duration < 2) {
      toast.warning(t("recording.tooShort") || "Please record at least a few seconds", {
        duration: 3000,
      });
      return;
    }
    stop();
  }, [stop, duration, t]);

  // Call onRecordingComplete when recording finishes (only once)
  // Requires minimum blob size to prevent triggering on empty blobs from reset()
  useEffect(() => {
    const MIN_VALID_BLOB_SIZE = 1000; // 1KB minimum - matches validation in audio.ts
    if (audioBlob && audioBlob.size >= MIN_VALID_BLOB_SIZE &&
        state === "stopped" && onRecordingComplete && !completedRef.current) {
      completedRef.current = true;
      onRecordingComplete(audioBlob);
    }
  }, [audioBlob, state, onRecordingComplete]);

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
          <AlertTitle>{t("common.important")}</AlertTitle>
          <AlertDescription>{t("recording.shareAudioWarning")}</AlertDescription>
        </Alert>
      )}

      {/* Mode Selection - Only show when idle */}
      {isIdle && (
        <div className="space-y-4">
          <h3 className="text-lg font-medium text-start">{t("recording.selectMode")}</h3>
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
            {/* Waveform - show idle animation when ready, live when recording */}
            {isIdle && mode && (
              <IdleWaveform className="w-full h-24" />
            )}
            {(isRecording || isPaused) && stream && (
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
            <div className="flex flex-col items-center gap-4 w-full">
              {(isIdle || isRequesting) && (
                <Button
                  size="lg"
                  onClick={handleStart}
                  disabled={!mode || isRequesting}
                  className={cn(
                    "gap-2 min-w-[200px] h-14 text-lg",
                    mode && "bg-primary hover:bg-primary/90 shadow-lg"
                  )}
                >
                  {isRequesting ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Mic className="h-6 w-6" />
                  )}
                  {isRequesting ? t("recording.requesting") : t("recording.start")}
                </Button>
              )}

              {!mode && isIdle && (
                <p className="text-sm text-muted-foreground text-center">
                  {t("recording.selectModeFirst")}
                </p>
              )}

              {isRecording && (
                <div className="flex items-center gap-4 flex-row-reverse">
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleStop}
                    className="gap-2 h-14 min-w-[140px]"
                  >
                    <Square className="h-5 w-5" />
                    {t("recording.stop")}
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={pause}
                    className="gap-2 h-14 min-w-[140px]"
                  >
                    <Pause className="h-5 w-5" />
                    {t("recording.pause")}
                  </Button>
                </div>
              )}

              {isPaused && (
                <div className="flex items-center gap-4 flex-row-reverse">
                  <Button
                    size="lg"
                    variant="destructive"
                    onClick={handleStop}
                    className="gap-2 h-14 min-w-[140px]"
                  >
                    <Square className="h-5 w-5" />
                    {t("recording.stop")}
                  </Button>
                  <Button
                    size="lg"
                    onClick={resume}
                    className="gap-2 h-14 min-w-[140px]"
                  >
                    <Play className="h-5 w-5" />
                    {t("recording.resume")}
                  </Button>
                </div>
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
              <h3 className="font-medium">{t("recording.preview")}</h3>
              <audio
                controls
                src={URL.createObjectURL(audioBlob)}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                {t("recording.duration")}: {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, "0")} •
                {t("recording.size")}: {(audioBlob.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
