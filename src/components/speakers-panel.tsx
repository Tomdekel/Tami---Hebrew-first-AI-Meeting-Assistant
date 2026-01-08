"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Users, Edit2, GitMerge, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";

// Speaker colors matching transcript-viewer
const SPEAKER_COLORS = [
  "hsl(221, 83%, 53%)", // blue
  "hsl(142, 71%, 45%)", // green
  "hsl(262, 83%, 58%)", // purple
  "hsl(25, 95%, 53%)",  // orange
  "hsl(340, 75%, 55%)", // pink
  "hsl(174, 72%, 40%)", // teal
  "hsl(43, 96%, 56%)",  // yellow
  "hsl(0, 84%, 60%)",   // red
];

interface Speaker {
  speakerId: string;
  speakerName: string;
  segmentCount: number;
}

interface SpeakersPanelProps {
  sessionId: string;
  speakers: Speaker[];
  onSpeakersChange: (speakers: Speaker[]) => void;
  onRefresh: () => void;
  isProcessing?: boolean;
}

export function SpeakersPanel({ sessionId, speakers, onSpeakersChange, onRefresh, isProcessing = false }: SpeakersPanelProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(true);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [mergingFrom, setMergingFrom] = useState<Speaker | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const getSpeakerColor = (index: number) => SPEAKER_COLORS[index % SPEAKER_COLORS.length];

  const handleRenameSpeaker = async () => {
    if (!editingSpeaker || !newSpeakerName.trim()) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/speakers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerId: editingSpeaker.speakerId,
          newName: newSpeakerName.trim(),
        }),
      });

      if (!response.ok) throw new Error("Failed to rename speaker");

      toast.success(t("speakers.renamed") || "Speaker renamed");
      onSpeakersChange(
        speakers.map((s) =>
          s.speakerId === editingSpeaker.speakerId
            ? { ...s, speakerName: newSpeakerName.trim() }
            : s
        )
      );
      setEditingSpeaker(null);
      setNewSpeakerName("");
      onRefresh();
    } catch {
      toast.error(t("speakers.renameFailed") || "Failed to rename speaker");
    }
  };

  const handleMergeSpeakers = async (targetSpeaker: Speaker) => {
    if (!mergingFrom || mergingFrom.speakerId === targetSpeaker.speakerId) return;

    setIsMerging(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSpeakerId: mergingFrom.speakerId,
          targetSpeakerId: targetSpeaker.speakerId,
        }),
      });

      if (!response.ok) throw new Error("Failed to merge speakers");

      const data = await response.json();

      toast.success(
        t("speakers.merged") || `Merged ${data.mergedCount} segments`,
        {
          description: `${mergingFrom.speakerName} → ${targetSpeaker.speakerName}`,
        }
      );

      // Update local state - remove source speaker, update target count
      onSpeakersChange(
        speakers
          .filter((s) => s.speakerId !== mergingFrom.speakerId)
          .map((s) =>
            s.speakerId === targetSpeaker.speakerId
              ? { ...s, segmentCount: s.segmentCount + mergingFrom.segmentCount }
              : s
          )
      );

      setMergingFrom(null);
      onRefresh();
    } catch {
      toast.error(t("speakers.mergeFailed") || "Failed to merge speakers");
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <CardTitle className="text-sm">{t("meeting.speakers")}</CardTitle>
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
            <CardContent className="pt-0">
              {isProcessing ? (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  {t("meeting.speakersWillAppear") || "דוברים יזוהו לאחר סיום התמלול"}
                </p>
              ) : speakers.length === 0 ? (
                <p className="text-muted-foreground text-center py-4 text-sm">
                  {t("meeting.noSpeakersIdentified")}
                </p>
              ) : (
                <div className="space-y-2">
                  {speakers.map((speaker, index) => (
                    <div
                      key={speaker.speakerId}
                      className="flex items-center justify-between p-2 rounded-lg border text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: getSpeakerColor(index) }}
                        />
                        <div className="min-w-0">
                          <p className="font-medium truncate">{speaker.speakerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {speaker.segmentCount} {t("meeting.segments")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => {
                            setEditingSpeaker(speaker);
                            setNewSpeakerName(speaker.speakerName);
                          }}
                          title={t("common.edit")}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        {speakers.length > 1 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title={t("speakers.merge") || "Merge"}
                              >
                                <GitMerge className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                                {t("speakers.mergeInto") || "Merge into..."}
                              </div>
                              {speakers
                                .filter((s) => s.speakerId !== speaker.speakerId)
                                .map((target) => (
                                  <DropdownMenuItem
                                    key={target.speakerId}
                                    onClick={() => {
                                      setMergingFrom(speaker);
                                      handleMergeSpeakers(target);
                                    }}
                                    disabled={isMerging}
                                  >
                                    <div
                                      className="h-2 w-2 rounded-full me-2"
                                      style={{ backgroundColor: getSpeakerColor(
                                        speakers.findIndex(s => s.speakerId === target.speakerId)
                                      ) }}
                                    />
                                    {target.speakerName}
                                    <span className="text-xs text-muted-foreground ms-2">
                                      ({target.segmentCount})
                                    </span>
                                  </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Edit Speaker Dialog */}
      <Dialog open={!!editingSpeaker} onOpenChange={() => setEditingSpeaker(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("meeting.renameSpeaker")}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="speakerName">{t("meeting.speakerName")}</Label>
            <Input
              id="speakerName"
              value={newSpeakerName}
              onChange={(e) => setNewSpeakerName(e.target.value)}
              placeholder={t("meeting.enterSpeakerName")}
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleRenameSpeaker();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingSpeaker(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleRenameSpeaker} disabled={!newSpeakerName.trim()}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
