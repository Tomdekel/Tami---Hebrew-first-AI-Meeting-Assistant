"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Building2,
  FolderKanban,
  Hash,
  Cpu,
  Package,
  MapPin,
  Calendar,
  HelpCircle,
} from "lucide-react";
import { EntityType } from "@/lib/neo4j/types";

const ENTITY_TYPES: {
  value: EntityType;
  label: string;
  icon: React.ElementType;
}[] = [
  { value: "person", label: "אדם", icon: User },
  { value: "organization", label: "ארגון", icon: Building2 },
  { value: "project", label: "פרויקט", icon: FolderKanban },
  { value: "topic", label: "נושא", icon: Hash },
  { value: "technology", label: "טכנולוגיה", icon: Cpu },
  { value: "product", label: "מוצר", icon: Package },
  { value: "location", label: "מיקום", icon: MapPin },
  { value: "date", label: "תאריך", icon: Calendar },
  { value: "other", label: "אחר", icon: HelpCircle },
];

interface AddEntityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    type: EntityType;
    value: string;
    description?: string;
    aliases?: string[];
  }) => void;
  isSubmitting?: boolean;
}

export function AddEntityModal({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting = false,
}: AddEntityModalProps) {
  const [type, setType] = useState<EntityType>("person");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [aliases, setAliases] = useState("");

  const handleSubmit = () => {
    onSubmit({
      type,
      value,
      description: description || undefined,
      aliases: aliases
        ? aliases
            .split(",")
            .map((a) => a.trim())
            .filter(Boolean)
        : undefined,
    });

    // Reset form
    setType("person");
    setValue("");
    setDescription("");
    setAliases("");
  };

  const selectedType = ENTITY_TYPES.find((t) => t.value === type);
  const Icon = selectedType?.icon || HelpCircle;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוסף אנטיטי חדש</DialogTitle>
          <p className="text-sm text-muted-foreground">
            הוסף אנטיטי חדש לגרף הידע שלך
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>סוג האנטיטי</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as EntityType)}
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{selectedType?.label}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map((entityType) => {
                  const TypeIcon = entityType.icon;
                  return (
                    <SelectItem key={entityType.value} value={entityType.value}>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4" />
                        <span>{entityType.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="value">שם</Label>
            <Input
              id="value"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={
                type === "person"
                  ? "יוסי כהן"
                  : type === "organization"
                    ? "חברת XYZ"
                    : "שם האנטיטי"
              }
              className="text-right"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="aliases">כינויים נוספים (אופציונלי)</Label>
            <Input
              id="aliases"
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="כינוי 1, כינוי 2"
              className="text-right"
            />
            <p className="text-xs text-muted-foreground">
              שמות חלופיים לזיהוי האנטיטי בפגישות
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור (אופציונלי)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תיאור קצר..."
              className="text-right min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={!value || isSubmitting}>
            {isSubmitting ? "מוסיף..." : "הוסף אנטיטי"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddEntityModal;
