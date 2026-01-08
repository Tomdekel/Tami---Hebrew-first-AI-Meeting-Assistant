"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CheckSquare,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";

interface ActionItem {
  id: string;
  description: string;
  assignee?: string | null;
  deadline?: string | null;
  completed: boolean;
}

interface Decision {
  description: string;
  context?: string | null;
}

interface Summary {
  overview: string | null;
  key_points?: string[] | null;
  decisions?: Decision[] | null;
  action_items?: ActionItem[] | null;
  edited_at?: string | null;
}

interface SummaryPanelProps {
  sessionId: string;
  summary: Summary | null;
  onRefresh: () => void;
  isProcessing?: boolean;
}

export function SummaryPanel({ sessionId, summary, onRefresh, isProcessing = false }: SummaryPanelProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localActionItems, setLocalActionItems] = useState<ActionItem[]>(
    summary?.action_items || []
  );

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/summarize`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate summary");
      }

      toast.success(t("meeting.summaryGenerated") || "Summary generated");
      onRefresh();
    } catch (err) {
      toast.error(t("common.error"), {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleActionItem = async (actionItemId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/action-items/${actionItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });

      if (!response.ok) throw new Error("Failed to update action item");

      setLocalActionItems((prev) =>
        prev.map((item) =>
          item.id === actionItemId ? { ...item, completed } : item
        )
      );

      toast.success(completed ? "Action item completed" : "Action item uncompleted");
    } catch {
      toast.error("Failed to update action item");
    }
  };

  const hasSummary = summary && summary.overview;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <CardTitle className="text-sm">{t("meeting.summary")}</CardTitle>
              </div>
              {isOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {isProcessing ? (
              <p className="text-muted-foreground text-center py-4 text-sm">
                {t("meeting.summaryWillBeGenerated") || "יופק אוטומטית לאחר סיום התמלול"}
              </p>
            ) : hasSummary ? (
              <>
                {/* Overview */}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xs font-medium text-muted-foreground">
                      {t("meeting.overview")}
                    </h4>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                      {t("meeting.aiGenerated") || "נוצר ע״י AI"}
                    </Badge>
                    {summary.edited_at && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {t("meeting.edited") || "נערך"}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm">{summary.overview}</p>
                </div>

                {/* Key Points */}
                {summary.key_points && summary.key_points.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">
                      {t("meeting.keyPoints")}
                    </h4>
                    <ul className="space-y-1">
                      {summary.key_points.slice(0, 5).map((point, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <span className="text-primary mt-0.5">•</span>
                          <span>{point}</span>
                        </li>
                      ))}
                      {summary.key_points.length > 5 && (
                        <li className="text-xs text-muted-foreground">
                          +{summary.key_points.length - 5} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Decisions */}
                {summary.decisions && summary.decisions.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">
                      {t("meeting.decisions")}
                    </h4>
                    <ul className="space-y-1">
                      {summary.decisions.slice(0, 3).map((decision, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{decision.description}</span>
                        </li>
                      ))}
                      {summary.decisions.length > 3 && (
                        <li className="text-xs text-muted-foreground">
                          +{summary.decisions.length - 3} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Action Items */}
                {localActionItems.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">
                      {t("meeting.actions")}
                    </h4>
                    <ul className="space-y-1">
                      {localActionItems.slice(0, 5).map((item) => (
                        <li key={item.id} className="flex items-start gap-2 text-sm">
                          <button
                            onClick={() => handleToggleActionItem(item.id, !item.completed)}
                            className="mt-0.5 text-muted-foreground hover:text-foreground"
                          >
                            {item.completed ? (
                              <CheckSquare className="h-4 w-4 text-green-500" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                          <span className={item.completed ? "line-through text-muted-foreground" : ""}>
                            {item.description}
                          </span>
                        </li>
                      ))}
                      {localActionItems.length > 5 && (
                        <li className="text-xs text-muted-foreground">
                          +{localActionItems.length - 5} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  {t("meeting.noSummaryYet")}
                </p>
                <Button
                  size="sm"
                  onClick={handleGenerateSummary}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-4 w-4 me-2 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4 me-2" />
                  )}
                  {t("meeting.generateSummary")}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
