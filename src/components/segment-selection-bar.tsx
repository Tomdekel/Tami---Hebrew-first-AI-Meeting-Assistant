"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, UserPlus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Speaker {
  speakerId: string;
  speakerName: string;
}

interface SegmentSelectionBarProps {
  selectedCount: number;
  speakers: Speaker[];
  onAssign: (speakerId: string, speakerName: string) => void;
  onCancel: () => void;
}

export function SegmentSelectionBar({
  selectedCount,
  speakers,
  onAssign,
  onCancel,
}: SegmentSelectionBarProps) {
  const t = useTranslations();
  const [targetSpeaker, setTargetSpeaker] = useState<string>("");
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async () => {
    if (!targetSpeaker && !newSpeakerName.trim()) {
      toast.error("Please select a speaker or enter a new name");
      return;
    }

    setIsAssigning(true);
    try {
      if (isCreatingNew && newSpeakerName.trim()) {
        // Create new speaker ID from name
        const newId = newSpeakerName.trim().toLowerCase().replace(/\s+/g, "_");
        onAssign(newId, newSpeakerName.trim());
      } else if (targetSpeaker) {
        const speaker = speakers.find((s) => s.speakerId === targetSpeaker);
        if (speaker) {
          onAssign(speaker.speakerId, speaker.speakerName);
        }
      }
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSpeakerChange = (value: string) => {
    if (value === "__new__") {
      setIsCreatingNew(true);
      setTargetSpeaker("");
    } else {
      setIsCreatingNew(false);
      setTargetSpeaker(value);
      setNewSpeakerName("");
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-background border rounded-lg shadow-lg p-4 flex items-center gap-4">
        {/* Selection count */}
        <div className="text-sm font-medium">
          {selectedCount} {t("meeting.segments") || "segments"} selected
        </div>

        {/* Separator */}
        <div className="h-8 w-px bg-border" />

        {/* Speaker selection */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t("speakers.assignTo") || "Assign to:"}
          </span>

          {isCreatingNew ? (
            <div className="flex items-center gap-2">
              <Input
                value={newSpeakerName}
                onChange={(e) => setNewSpeakerName(e.target.value)}
                placeholder={t("meeting.enterSpeakerName") || "Enter name..."}
                className="w-40 h-8 text-sm"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  setIsCreatingNew(false);
                  setNewSpeakerName("");
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Select value={targetSpeaker} onValueChange={handleSpeakerChange}>
              <SelectTrigger className="w-40 h-8 text-sm">
                <SelectValue placeholder={t("speakers.selectSpeaker") || "Select..."} />
              </SelectTrigger>
              <SelectContent>
                {speakers.map((speaker) => (
                  <SelectItem key={speaker.speakerId} value={speaker.speakerId}>
                    {speaker.speakerName}
                  </SelectItem>
                ))}
                <SelectItem value="__new__">
                  <span className="flex items-center gap-2">
                    <UserPlus className="h-3 w-3" />
                    {t("speakers.newSpeaker") || "New speaker..."}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleAssign}
            disabled={isAssigning || (!targetSpeaker && !newSpeakerName.trim())}
          >
            <Check className="h-4 w-4 me-1" />
            {t("speakers.assign") || "Assign"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isAssigning}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Export the component's expected state interface
export interface SegmentSelectionState {
  targetSpeakerId: string;
  newSpeakerName: string;
}
