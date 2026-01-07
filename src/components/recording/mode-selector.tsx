"use client";

import { useTranslations } from "next-intl";
import { Mic, Monitor } from "lucide-react";
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
  );
}
