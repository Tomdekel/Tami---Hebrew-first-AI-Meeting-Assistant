"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Users, Edit2, GitMerge, ChevronDown, ChevronUp, UserCheck, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Person {
  id: string;
  display_name: string;
  normalized_key: string;
}

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
  personId?: string | null;
  personName?: string | null;
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

  // Person assignment state
  const [assigningSpeaker, setAssigningSpeaker] = useState<Speaker | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // Fetch people list when assignment dialog opens
  const fetchPeople = useCallback(async () => {
    setIsLoadingPeople(true);
    try {
      const response = await fetch("/api/people");
      if (response.ok) {
        const data = await response.json();
        setPeople(data.people || []);
      }
    } catch (error) {
      console.error("Failed to fetch people:", error);
    } finally {
      setIsLoadingPeople(false);
    }
  }, []);

  useEffect(() => {
    if (assigningSpeaker) {
      fetchPeople();
      setNewPersonName(assigningSpeaker.speakerName);
    }
  }, [assigningSpeaker, fetchPeople]);

  // Assign speaker to existing person
  const handleAssignToPerson = async (person: Person) => {
    if (!assigningSpeaker) return;
    setIsAssigning(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/speakers/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerId: assigningSpeaker.speakerId,
          personId: person.id,
          personName: person.display_name,
        }),
      });

      if (!response.ok) throw new Error("Failed to assign speaker");

      toast.success(t("speakers.assigned") || "Speaker assigned to person");
      onSpeakersChange(
        speakers.map((s) =>
          s.speakerId === assigningSpeaker.speakerId
            ? { ...s, personId: person.id, personName: person.display_name }
            : s
        )
      );
      setAssigningSpeaker(null);
      onRefresh();
    } catch {
      toast.error(t("speakers.assignFailed") || "Failed to assign speaker");
    } finally {
      setIsAssigning(false);
    }
  };

  // Create new person and assign speaker
  const handleCreateAndAssign = async () => {
    if (!assigningSpeaker || !newPersonName.trim()) return;
    setIsAssigning(true);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/speakers/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerId: assigningSpeaker.speakerId,
          personName: newPersonName.trim(),
        }),
      });

      if (!response.ok) throw new Error("Failed to assign speaker");

      const data = await response.json();
      toast.success(t("speakers.assigned") || "Speaker assigned to new person");
      onSpeakersChange(
        speakers.map((s) =>
          s.speakerId === assigningSpeaker.speakerId
            ? { ...s, personId: data.personId, personName: newPersonName.trim() }
            : s
        )
      );
      setAssigningSpeaker(null);
      onRefresh();
    } catch {
      toast.error(t("speakers.assignFailed") || "Failed to assign speaker");
    } finally {
      setIsAssigning(false);
    }
  };

  // Unassign speaker from person
  const handleUnassign = async (speaker: Speaker) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/speakers/assign`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerId: speaker.speakerId,
        }),
      });

      if (!response.ok) throw new Error("Failed to unassign speaker");

      toast.success(t("speakers.unassigned") || "Speaker unassigned");
      onSpeakersChange(
        speakers.map((s) =>
          s.speakerId === speaker.speakerId
            ? { ...s, personId: null, personName: null }
            : s
        )
      );
      onRefresh();
    } catch {
      toast.error(t("speakers.unassignFailed") || "Failed to unassign speaker");
    }
  };

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
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: getSpeakerColor(index) }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium truncate">{speaker.speakerName}</p>
                            {speaker.personId && speaker.personName && (
                              <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                                <UserCheck className="h-3 w-3" />
                                {speaker.personName}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUnassign(speaker);
                                  }}
                                  className="hover:bg-muted rounded-full p-0.5 -me-1"
                                  title={t("speakers.unassign") || "Unassign"}
                                >
                                  <X className="h-2.5 w-2.5" />
                                </button>
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {speaker.segmentCount} {t("meeting.segments")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {!speaker.personId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setAssigningSpeaker(speaker)}
                            title={t("speakers.assignPerson") || "Assign to person"}
                          >
                            <UserPlus className="h-3 w-3" />
                          </Button>
                        )}
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

      {/* Assign to Person Dialog */}
      <Dialog open={!!assigningSpeaker} onOpenChange={() => setAssigningSpeaker(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("speakers.assignToPerson") || "Assign to Person"}</DialogTitle>
            <DialogDescription>
              {t("speakers.assignDescription") || `Link "${assigningSpeaker?.speakerName}" to a person for better search across all meetings.`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {/* Create new person */}
            <div>
              <Label htmlFor="newPersonName">{t("speakers.createNewPerson") || "Create new person"}</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  id="newPersonName"
                  value={newPersonName}
                  onChange={(e) => setNewPersonName(e.target.value)}
                  placeholder={t("speakers.personName") || "Person name"}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newPersonName.trim()) {
                      handleCreateAndAssign();
                    }
                  }}
                />
                <Button
                  onClick={handleCreateAndAssign}
                  disabled={!newPersonName.trim() || isAssigning}
                >
                  <UserPlus className="h-4 w-4 me-2" />
                  {t("common.create") || "Create"}
                </Button>
              </div>
            </div>

            {/* Existing people list */}
            {people.length > 0 && (
              <div>
                <Label>{t("speakers.orSelectExisting") || "Or select existing person"}</Label>
                <div className="mt-2 max-h-48 overflow-y-auto border rounded-lg">
                  {isLoadingPeople ? (
                    <p className="text-sm text-muted-foreground p-3 text-center">
                      {t("common.loading") || "Loading..."}
                    </p>
                  ) : (
                    people.map((person) => (
                      <button
                        key={person.id}
                        onClick={() => handleAssignToPerson(person)}
                        disabled={isAssigning}
                        className="w-full text-start px-3 py-2 hover:bg-muted border-b last:border-b-0 flex items-center gap-2 disabled:opacity-50"
                      >
                        <UserCheck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{person.display_name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningSpeaker(null)}>
              {t("common.cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
