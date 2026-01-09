"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Pencil,
  Save,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedOverview, setEditedOverview] = useState(summary?.overview || "");
  const [editedKeyPoints, setEditedKeyPoints] = useState<string[]>(summary?.key_points || []);
  const [editedDecisions, setEditedDecisions] = useState<Decision[]>(summary?.decisions || []);

  // Sync local state when summary prop changes
  useEffect(() => {
    setEditedOverview(summary?.overview || "");
    setEditedKeyPoints(summary?.key_points || []);
    setEditedDecisions(summary?.decisions || []);
  }, [summary]);

  const handleStartEdit = () => {
    setEditedOverview(summary?.overview || "");
    setEditedKeyPoints(summary?.key_points || []);
    setEditedDecisions(summary?.decisions || []);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedOverview(summary?.overview || "");
    setEditedKeyPoints(summary?.key_points || []);
    setEditedDecisions(summary?.decisions || []);
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/summarize`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overview: editedOverview,
          key_points: editedKeyPoints,
          decisions: editedDecisions,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save summary");
      }

      toast.success(t("common.save") + " ✓");
      setIsEditing(false);
      onRefresh();
    } catch (err) {
      toast.error(t("common.error"), {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyPointChange = (index: number, value: string) => {
    const newPoints = [...editedKeyPoints];
    newPoints[index] = value;
    setEditedKeyPoints(newPoints);
  };

  const handleAddKeyPoint = () => {
    setEditedKeyPoints([...editedKeyPoints, ""]);
  };

  const handleRemoveKeyPoint = (index: number) => {
    setEditedKeyPoints(editedKeyPoints.filter((_, i) => i !== index));
  };

  const handleDecisionChange = (index: number, value: string) => {
    const newDecisions = [...editedDecisions];
    newDecisions[index] = { ...newDecisions[index], description: value };
    setEditedDecisions(newDecisions);
  };

  const handleAddDecision = () => {
    setEditedDecisions([...editedDecisions, { description: "" }]);
  };

  const handleRemoveDecision = (index: number) => {
    setEditedDecisions(editedDecisions.filter((_, i) => i !== index));
  };

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

  const hasSummary = summary && summary.overview;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity flex-1">
                <Sparkles className="h-4 w-4" />
                <CardTitle className="text-sm">{t("meeting.summary")}</CardTitle>
                {isOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CollapsibleTrigger>
            {hasSummary && !isEditing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                className="h-7 px-2"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {isEditing && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-7 px-2"
                  disabled={isSaving}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveEdit}
                  className="h-7 px-2"
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
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
                    {!isEditing && (
                      <>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                          {t("meeting.aiGenerated") || "נוצר ע״י AI"}
                        </Badge>
                        {summary.edited_at && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {t("meeting.edited") || "נערך"}
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                  {isEditing ? (
                    <Textarea
                      value={editedOverview}
                      onChange={(e) => setEditedOverview(e.target.value)}
                      className="min-h-[80px] text-sm"
                    />
                  ) : (
                    <p className="text-sm">{summary.overview}</p>
                  )}
                </div>

                {/* Key Points */}
                {(isEditing || (summary.key_points && summary.key_points.length > 0)) && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">
                      {t("meeting.keyPoints")}
                    </h4>
                    {isEditing ? (
                      <div className="space-y-2">
                        {editedKeyPoints.map((point, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <span className="text-primary">•</span>
                            <Input
                              value={point}
                              onChange={(e) => handleKeyPointChange(index, e.target.value)}
                              className="flex-1 h-8 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveKeyPoint(index)}
                              className="h-7 px-2 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddKeyPoint}
                          className="h-7 text-xs"
                        >
                          + Add Point
                        </Button>
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {summary.key_points!.slice(0, 5).map((point, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <span className="text-primary mt-0.5">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                        {summary.key_points!.length > 5 && (
                          <li className="text-xs text-muted-foreground">
                            +{summary.key_points!.length - 5} more...
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )}

                {/* Decisions */}
                {(isEditing || (summary.decisions && summary.decisions.length > 0)) && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-1">
                      {t("meeting.decisions")}
                    </h4>
                    {isEditing ? (
                      <div className="space-y-2">
                        {editedDecisions.map((decision, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                            <Input
                              value={decision.description}
                              onChange={(e) => handleDecisionChange(index, e.target.value)}
                              className="flex-1 h-8 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveDecision(index)}
                              className="h-7 px-2 text-muted-foreground hover:text-destructive"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddDecision}
                          className="h-7 text-xs"
                        >
                          + Add Decision
                        </Button>
                      </div>
                    ) : (
                      <ul className="space-y-1">
                        {summary.decisions!.slice(0, 3).map((decision, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{decision.description}</span>
                          </li>
                        ))}
                        {summary.decisions!.length > 3 && (
                          <li className="text-xs text-muted-foreground">
                            +{summary.decisions!.length - 3} more...
                          </li>
                        )}
                      </ul>
                    )}
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
