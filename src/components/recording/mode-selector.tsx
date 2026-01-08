"use client";

import { useTranslations } from "next-intl";
import { Mic, Monitor, Info, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RecordingMode } from "@/hooks/use-recording";

interface ModeSelectorProps {
  selectedMode: RecordingMode | null;
  onSelectMode: (mode: RecordingMode) => void;
  disabled?: boolean;
}

export function ModeSelector({
  selectedMode,
  onSelectMode,
  disabled,
}: ModeSelectorProps) {
  const t = useTranslations("recording");
  const tSystem = useTranslations("systemAudio");

  const modes: { id: RecordingMode; icon: typeof Mic; title: string; description: string }[] = [
    {
      id: "microphone",
      icon: Mic,
      title: t("microphone"),
      description: t("microphoneDesc"),
    },
    {
      id: "system",
      icon: Monitor,
      title: t("systemAudio"),
      description: t("systemAudioDesc"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;

          return (
            <Card
              key={mode.id}
              className={cn(
                "cursor-pointer transition-all hover:border-primary/50",
                isSelected && "border-primary ring-2 ring-primary/20",
                disabled && "opacity-50 cursor-not-allowed"
              )}
              onClick={() => !disabled && onSelectMode(mode.id)}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg">{mode.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{mode.description}</CardDescription>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* System Audio Explainer - shown inline when system audio is selected */}
      {selectedMode === "system" && (
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <CardTitle className="text-base text-blue-900 dark:text-blue-100">
                {tSystem("title")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <ol className="space-y-2 text-sm text-blue-800 dark:text-blue-200" dir="auto">
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800 text-xs font-medium">1</span>
                <span>{tSystem("step1")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800 text-xs font-medium">2</span>
                <span>{tSystem("step2")}</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 dark:text-green-400" />
                <span className="font-medium">{tSystem("step3")}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-200 dark:bg-blue-800 text-xs font-medium">4</span>
                <span>{tSystem("step4")}</span>
              </li>
            </ol>
            <p className="mt-3 text-xs text-blue-600 dark:text-blue-400 border-t border-blue-200 dark:border-blue-700 pt-3">
              {tSystem("note")}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
