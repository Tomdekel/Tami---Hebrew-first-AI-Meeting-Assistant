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
  User,
  Building2,
  FolderKanban,
  Hash,
  Cpu,
  Package,
  MapPin,
  Calendar,
  Tag,
  DollarSign,
  Lightbulb,
  AlertTriangle,
  FileText,
  Grid,
  type LucideIcon,
} from "lucide-react";

const ICONS: { name: string; icon: LucideIcon }[] = [
  { name: "tag", icon: Tag },
  { name: "dollar", icon: DollarSign },
  { name: "lightbulb", icon: Lightbulb },
  { name: "alert", icon: AlertTriangle },
  { name: "file", icon: FileText },
  { name: "grid", icon: Grid },
  { name: "user", icon: User },
  { name: "building", icon: Building2 },
  { name: "folder", icon: FolderKanban },
  { name: "hash", icon: Hash },
  { name: "cpu", icon: Cpu },
  { name: "package", icon: Package },
  { name: "map", icon: MapPin },
  { name: "calendar", icon: Calendar },
];

const COLORS = [
  { name: "ורוד", value: "#EC4899" },
  { name: "כחול", value: "#3B82F6" },
  { name: "סגול", value: "#8B5CF6" },
  { name: "ירוק", value: "#10B981" },
  { name: "כתום", value: "#F97316" },
  { name: "צהוב", value: "#EAB308" },
  { name: "ציאן", value: "#06B6D4" },
  { name: "אדום", value: "#EF4444" },
];

export interface EntityTypeData {
  name: string;
  nameEn: string;
  color: string;
  icon: string;
  description: string;
  examples: string[];
}

interface AddEntityTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EntityTypeData) => void;
}

export function AddEntityTypeModal({
  open,
  onOpenChange,
  onSubmit,
}: AddEntityTypeModalProps) {
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
  const [selectedIcon, setSelectedIcon] = useState("tag");
  const [description, setDescription] = useState("");
  const [examples, setExamples] = useState("");

  const handleSubmit = () => {
    onSubmit({
      name,
      nameEn: nameEn || name.toLowerCase().replace(/\s+/g, "_"),
      color: selectedColor,
      icon: selectedIcon,
      description,
      examples: examples
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean),
    });

    // Reset form
    setName("");
    setNameEn("");
    setSelectedColor(COLORS[0].value);
    setSelectedIcon("tag");
    setDescription("");
    setExamples("");

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוסף סוג אנטיטי חדש</DialogTitle>
          <p className="text-sm text-muted-foreground">
            הגדר סוג אנטיטי חדש שלא קיים עדיין במערכת
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label htmlFor="name">שם הסוג</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="מותגים"
              className="text-right"
              style={{
                backgroundColor: selectedColor + "20",
                borderColor: selectedColor,
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nameEn">שם באנגלית (לקוד)</Label>
            <Input
              id="nameEn"
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="brands"
              dir="ltr"
            />
          </div>

          <div className="space-y-2">
            <Label>צבע</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSelectedColor(color.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    selectedColor === color.value
                      ? "border-foreground scale-110"
                      : "border-transparent"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>אייקון</Label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map(({ name: iconName, icon: Icon }) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setSelectedIcon(iconName)}
                  className={`p-2 rounded border transition-colors ${
                    selectedIcon === iconName
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted hover:bg-muted/80 border-transparent"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="examples">דוגמאות (אופציונלי)</Label>
            <Input
              id="examples"
              value={examples}
              onChange={(e) => setExamples(e.target.value)}
              placeholder="Nike, Apple, Samsung"
              dir="ltr"
            />
            <p className="text-xs text-muted-foreground">
              הפרד בפסיקים בין הדוגמאות
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תיאור קצר של סוג האנטיטי..."
              className="text-right min-h-[80px]"
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={!name}>
            הוסף סוג חדש
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddEntityTypeModal;
