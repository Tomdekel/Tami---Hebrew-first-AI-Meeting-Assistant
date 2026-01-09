"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Loader2,
  GitMerge,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  Brain,
  Search,
  TextQuote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DuplicateEntity {
  id: string;
  displayValue: string;
  normalizedValue: string;
  type: string;
  mentionCount: number;
  aliases: string[];
  similarity?: {
    score: number;
    method: string;
    reason: string;
  };
}

interface DuplicateGroup {
  canonical: DuplicateEntity;
  duplicates: DuplicateEntity[];
  totalDuplicates: number;
}

interface DuplicateSummary {
  totalGroups: number;
  totalDuplicates: number;
  entitiesAffected: number;
  totalEntities: number;
  duplicatePercentage: number;
}

interface DuplicateReviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMergeComplete?: () => void;
}

const methodIcons: Record<string, React.ReactNode> = {
  alias: <TextQuote className="w-3 h-3" />,
  fuzzy: <Search className="w-3 h-3" />,
  semantic: <Sparkles className="w-3 h-3" />,
  llm: <Brain className="w-3 h-3" />,
};

const methodLabels: Record<string, string> = {
  alias: "Alias Match",
  fuzzy: "Fuzzy Match",
  semantic: "Semantic",
  llm: "AI Analysis",
};

export function DuplicateReviewModal({
  open,
  onOpenChange,
  onMergeComplete,
}: DuplicateReviewModalProps) {
  const t = useTranslations();
  const locale = useLocale();
  const isRTL = locale === "he";

  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState<string | null>(null);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [summary, setSummary] = useState<DuplicateSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergedGroups, setMergedGroups] = useState<Set<string>>(new Set());

  // Load duplicates when modal opens
  useEffect(() => {
    if (open) {
      loadDuplicates();
    }
  }, [open]);

  const loadDuplicates = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch("/api/graph/entities/duplicates?threshold=0.7");
      if (!response.ok) {
        throw new Error("Failed to load duplicates");
      }

      const data = await response.json();
      setGroups(data.groups || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMerge = async (canonical: DuplicateEntity, duplicate: DuplicateEntity) => {
    const mergeKey = `${canonical.id}-${duplicate.id}`;
    try {
      setIsMerging(mergeKey);

      const response = await fetch(`/api/graph/entities/${canonical.id}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: duplicate.id }),
      });

      if (!response.ok) {
        throw new Error("Failed to merge entities");
      }

      // Mark as merged
      setMergedGroups((prev) => new Set([...prev, mergeKey]));

      // Remove merged entity from the group
      setGroups((prev) =>
        prev
          .map((group) => {
            if (group.canonical.id === canonical.id) {
              return {
                ...group,
                duplicates: group.duplicates.filter((d) => d.id !== duplicate.id),
                totalDuplicates: group.totalDuplicates - 1,
              };
            }
            return group;
          })
          .filter((group) => group.duplicates.length > 0)
      );

      // Update summary
      if (summary) {
        setSummary({
          ...summary,
          totalDuplicates: summary.totalDuplicates - 1,
          entitiesAffected: summary.entitiesAffected - 1,
        });
      }

      onMergeComplete?.();
    } catch (err) {
      console.error("Merge error:", err);
    } finally {
      setIsMerging(null);
    }
  };

  const handleMergeAll = async (group: DuplicateGroup) => {
    for (const duplicate of group.duplicates) {
      const mergeKey = `${group.canonical.id}-${duplicate.id}`;
      if (!mergedGroups.has(mergeKey)) {
        await handleMerge(group.canonical, duplicate);
      }
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.9) return "text-green-600";
    if (score >= 0.8) return "text-yellow-600";
    return "text-orange-600";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5" />
            {isRTL ? "סקירת כפילויות" : "Review Duplicates"}
          </DialogTitle>
          <DialogDescription>
            {isRTL
              ? "ישויות שזוהו כעותקים אפשריים. לחץ על 'מיזוג' כדי לאחד אותן."
              : "Entities detected as possible duplicates. Click 'Merge' to combine them."}
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        {summary && !isLoading && (
          <div className="grid grid-cols-3 gap-4 mb-4">
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{summary.totalGroups}</div>
                <div className="text-xs text-muted-foreground">
                  {isRTL ? "קבוצות כפילויות" : "Duplicate Groups"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{summary.totalDuplicates}</div>
                <div className="text-xs text-muted-foreground">
                  {isRTL ? "עותקים לזיהוי" : "Duplicates Found"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/50">
              <CardContent className="p-3 text-center">
                <div className="text-2xl font-bold">{summary.duplicatePercentage}%</div>
                <div className="text-xs text-muted-foreground">
                  {isRTL ? "מהישויות" : "Of Entities"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <ScrollArea className="h-[400px] pr-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full gap-2">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {isRTL ? "מחפש כפילויות..." : "Scanning for duplicates..."}
              </p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
              <AlertTriangle className="h-8 w-8" />
              <p>{error}</p>
              <Button variant="outline" size="sm" onClick={loadDuplicates}>
                {isRTL ? "נסה שוב" : "Try Again"}
              </Button>
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <p className="text-lg font-medium">
                {isRTL ? "לא נמצאו כפילויות!" : "No duplicates found!"}
              </p>
              <p className="text-sm">
                {isRTL
                  ? "כל הישויות שלך ייחודיות"
                  : "All your entities appear to be unique"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {groups.map((group) => (
                <Card key={group.canonical.id} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize">
                          {group.canonical.type}
                        </Badge>
                        <span className="font-semibold">
                          {group.canonical.displayValue}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {group.canonical.mentionCount}{" "}
                          {isRTL ? "אזכורים" : "mentions"}
                        </Badge>
                      </div>
                      {group.duplicates.length > 1 && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleMergeAll(group)}
                          disabled={isMerging !== null}
                        >
                          <GitMerge className="w-4 h-4 mr-1" />
                          {isRTL ? "מזג הכל" : "Merge All"}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0 divide-y">
                    {group.duplicates.map((duplicate) => {
                      const mergeKey = `${group.canonical.id}-${duplicate.id}`;
                      const isMerged = mergedGroups.has(mergeKey);
                      const isThisMerging = isMerging === mergeKey;

                      return (
                        <div
                          key={duplicate.id}
                          className={cn(
                            "flex items-center justify-between p-3 transition-colors",
                            isMerged && "bg-green-50 dark:bg-green-950/20"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {duplicate.displayValue}
                                </span>
                                <Badge variant="secondary" className="text-xs">
                                  {duplicate.mentionCount}{" "}
                                  {isRTL ? "אזכורים" : "mentions"}
                                </Badge>
                              </div>
                              {duplicate.similarity && (
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                    {methodIcons[duplicate.similarity.method]}
                                    <span>
                                      {methodLabels[duplicate.similarity.method]}
                                    </span>
                                  </div>
                                  <span className="text-xs">•</span>
                                  <span
                                    className={cn(
                                      "text-xs font-medium",
                                      getScoreColor(duplicate.similarity.score)
                                    )}
                                  >
                                    {Math.round(duplicate.similarity.score * 100)}%{" "}
                                    {isRTL ? "התאמה" : "match"}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {duplicate.similarity.reason}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div>
                            {isMerged ? (
                              <Badge
                                variant="outline"
                                className="bg-green-100 text-green-700"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                {isRTL ? "מוזג" : "Merged"}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  handleMerge(group.canonical, duplicate)
                                }
                                disabled={isMerging !== null}
                              >
                                {isThisMerging ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <GitMerge className="w-4 h-4 mr-1" />
                                    {isRTL ? "מזג" : "Merge"}
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {isRTL ? "סגור" : "Close"}
          </Button>
          <Button variant="outline" onClick={loadDuplicates} disabled={isLoading}>
            <Search className="w-4 h-4 mr-1" />
            {isRTL ? "סרוק שוב" : "Rescan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
