"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Mic, Upload, FileText } from "lucide-react";
import type { SourceType, IngestionConfidence } from "@/lib/types/database";
import { useTranslations } from "next-intl";

interface SourceBadgeProps {
  sourceType: SourceType;
  confidence?: IngestionConfidence;
  showConfidence?: boolean;
  className?: string;
}

const SOURCE_CONFIG: Record<SourceType, {
  icon: typeof Mic;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  recorded: {
    icon: Mic,
    bgColor: "bg-green-100 dark:bg-green-900/30",
    textColor: "text-green-700 dark:text-green-400",
    borderColor: "border-green-200 dark:border-green-800",
  },
  imported: {
    icon: Upload,
    bgColor: "bg-amber-100 dark:bg-amber-900/30",
    textColor: "text-amber-700 dark:text-amber-400",
    borderColor: "border-amber-200 dark:border-amber-800",
  },
  summary_only: {
    icon: FileText,
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    textColor: "text-orange-700 dark:text-orange-400",
    borderColor: "border-orange-200 dark:border-orange-800",
  },
};

const CONFIDENCE_INDICATOR: Record<IngestionConfidence, string> = {
  high: "bg-green-500",
  medium: "bg-yellow-500",
  low: "bg-red-500",
};

export function SourceBadge({
  sourceType,
  confidence,
  showConfidence = false,
  className,
}: SourceBadgeProps) {
  const t = useTranslations("meetings");
  const config = SOURCE_CONFIG[sourceType];
  const Icon = config.icon;

  // Translation keys for source types
  const sourceLabels: Record<SourceType, string> = {
    recorded: t("source.recorded"),
    imported: t("source.imported"),
    summary_only: t("source.summaryOnly"),
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 font-normal",
        config.bgColor,
        config.textColor,
        config.borderColor,
        className
      )}
      title={getTooltipText(sourceType, confidence, t)}
    >
      <Icon className="h-3 w-3" />
      <span>{sourceLabels[sourceType]}</span>
      {showConfidence && confidence && (
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            CONFIDENCE_INDICATOR[confidence]
          )}
          title={t(`confidence.${confidence}`)}
        />
      )}
    </Badge>
  );
}

function getTooltipText(
  sourceType: SourceType,
  confidence: IngestionConfidence | undefined,
  t: ReturnType<typeof useTranslations<"meetings">>
): string {
  const tooltips: Record<SourceType, string> = {
    recorded: t("sourceTooltip.recorded"),
    imported: t("sourceTooltip.imported"),
    summary_only: t("sourceTooltip.summaryOnly"),
  };

  let tooltip = tooltips[sourceType];

  if (confidence) {
    const confidenceTooltips: Record<IngestionConfidence, string> = {
      high: t("confidenceTooltip.high"),
      medium: t("confidenceTooltip.medium"),
      low: t("confidenceTooltip.low"),
    };
    tooltip += ` (${confidenceTooltips[confidence]})`;
  }

  return tooltip;
}

// Compact version for list views
export function SourceIndicator({
  sourceType,
  className,
}: {
  sourceType: SourceType;
  className?: string;
}) {
  const config = SOURCE_CONFIG[sourceType];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center h-5 w-5 rounded-full",
        config.bgColor,
        config.textColor,
        className
      )}
      title={sourceType}
    >
      <Icon className="h-3 w-3" />
    </span>
  );
}
