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
  Plus,
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
import { useLanguage } from "@/contexts/language-context";

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

interface Note {
  title: string;
  emoji: string;
  startTime: string;
  endTime: string;
  bullets: string[];
}

interface Summary {
  overview: string | null;
  key_points?: string[] | null;
  decisions?: Decision[] | null;
  notes?: Note[] | null;
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
  const { isRTL } = useLanguage();
  const [isOpen, setIsOpen] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedOverview, setEditedOverview] = useState(summary?.overview || "");
  const [editedKeyPoints, setEditedKeyPoints] = useState<string[]>(summary?.key_points || []);
  const [editedDecisions, setEditedDecisions] = useState<Decision[]>(summary?.decisions || []);
  const [editedNotes, setEditedNotes] = useState<Note[]>(summary?.notes || []);

  // Sync local state when summary prop changes
  useEffect(() => {
    setEditedOverview(summary?.overview || "");
    setEditedKeyPoints(summary?.key_points || []);
    setEditedDecisions(summary?.decisions || []);
    setEditedNotes(summary?.notes || []);
  }, [summary]);

  const handleStartEdit = () => {
    setEditedOverview(summary?.overview || "");
    setEditedKeyPoints(summary?.key_points || []);
    setEditedDecisions(summary?.decisions || []);
    setEditedNotes(summary?.notes || []);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setEditedOverview(summary?.overview || "");
    setEditedKeyPoints(summary?.key_points || []);
    setEditedDecisions(summary?.decisions || []);
    setEditedNotes(summary?.notes || []);
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
          notes: editedNotes,
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

  // Note editing handlers
  const handleNoteChange = (noteIndex: number, field: keyof Note, value: string | string[]) => {
    const newNotes = [...editedNotes];
    newNotes[noteIndex] = { ...newNotes[noteIndex], [field]: value };
    setEditedNotes(newNotes);
  };

  const handleNoteBulletChange = (noteIndex: number, bulletIndex: number, value: string) => {
    const newNotes = [...editedNotes];
    const newBullets = [...newNotes[noteIndex].bullets];
    newBullets[bulletIndex] = value;
    newNotes[noteIndex] = { ...newNotes[noteIndex], bullets: newBullets };
    setEditedNotes(newNotes);
  };

  const handleAddNoteBullet = (noteIndex: number) => {
    const newNotes = [...editedNotes];
    newNotes[noteIndex] = {
      ...newNotes[noteIndex],
      bullets: [...newNotes[noteIndex].bullets, ""],
    };
    setEditedNotes(newNotes);
  };

  const handleRemoveNoteBullet = (noteIndex: number, bulletIndex: number) => {
    const newNotes = [...editedNotes];
    newNotes[noteIndex] = {
      ...newNotes[noteIndex],
      bullets: newNotes[noteIndex].bullets.filter((_, i) => i !== bulletIndex),
    };
    setEditedNotes(newNotes);
  };

  const handleAddNote = () => {
    setEditedNotes([
      ...editedNotes,
      { title: "", emoji: "📝", startTime: "00:00", endTime: "00:00", bullets: [""] },
    ]);
  };

  const handleRemoveNote = (noteIndex: number) => {
    setEditedNotes(editedNotes.filter((_, i) => i !== noteIndex));
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
                variant="outline"
                size="sm"
                onClick={handleStartEdit}
                className="h-7 px-2 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3.5 w-3.5 me-1" />
                <span className="text-xs">{isRTL ? "עריכה" : "Edit"}</span>
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

                {/* Notes - Timestamped Sections */}
                {(isEditing || (summary.notes && summary.notes.length > 0)) && (
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground mb-2">
                      {isRTL ? "הערות" : "Notes"}
                    </h4>
                    {isEditing ? (
                      <div className="space-y-4">
                        {editedNotes.map((note, noteIndex) => (
                          <div key={noteIndex} className="border rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <Input
                                value={note.emoji}
                                onChange={(e) => handleNoteChange(noteIndex, "emoji", e.target.value)}
                                className="w-12 h-8 text-center"
                                maxLength={2}
                              />
                              <Input
                                value={note.title}
                                onChange={(e) => handleNoteChange(noteIndex, "title", e.target.value)}
                                placeholder={isRTL ? "כותרת הסעיף" : "Section title"}
                                className="flex-1 h-8 text-sm"
                              />
                              <Input
                                value={note.startTime}
                                onChange={(e) => handleNoteChange(noteIndex, "startTime", e.target.value)}
                                placeholder="00:00"
                                className="w-16 h-8 text-xs font-mono"
                              />
                              <span className="text-muted-foreground">-</span>
                              <Input
                                value={note.endTime}
                                onChange={(e) => handleNoteChange(noteIndex, "endTime", e.target.value)}
                                placeholder="00:00"
                                className="w-16 h-8 text-xs font-mono"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveNote(noteIndex)}
                                className="h-7 px-2 text-muted-foreground hover:text-destructive"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="space-y-1 ms-4">
                              {note.bullets.map((bullet, bulletIndex) => (
                                <div key={bulletIndex} className="flex items-center gap-2">
                                  <span className="text-muted-foreground">•</span>
                                  <Input
                                    value={bullet}
                                    onChange={(e) => handleNoteBulletChange(noteIndex, bulletIndex, e.target.value)}
                                    className="flex-1 h-7 text-sm"
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoveNoteBullet(noteIndex, bulletIndex)}
                                    className="h-6 px-1 text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAddNoteBullet(noteIndex)}
                                className="h-6 text-xs text-muted-foreground"
                              >
                                <Plus className="h-3 w-3 me-1" />
                                {isRTL ? "הוסף נקודה" : "Add bullet"}
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleAddNote}
                          className="h-7 text-xs"
                        >
                          <Plus className="h-3 w-3 me-1" />
                          {isRTL ? "הוסף סעיף" : "Add section"}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {summary.notes!.map((note, index) => (
                          <div key={index}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">{note.emoji}</span>
                              <h5 className="font-medium text-sm">{note.title}</h5>
                              <span className="text-xs text-muted-foreground font-mono">
                                ({note.startTime} - {note.endTime})
                              </span>
                            </div>
                            <ul className="space-y-0.5 ms-6">
                              {note.bullets.map((bullet, bIdx) => (
                                <li key={bIdx} className="text-sm text-muted-foreground">
                                  • {bullet}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Key Points - Hidden when notes exist (notes are more detailed) */}
                {(isEditing || (summary.key_points && summary.key_points.length > 0 && (!summary.notes || summary.notes.length === 0))) && (
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
                          + {isRTL ? "הוסף נקודה" : "Add Point"}
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
                          + {isRTL ? "הוסף החלטה" : "Add Decision"}
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
