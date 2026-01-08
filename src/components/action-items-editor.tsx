"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Loader2,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ListTodo,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ActionItem {
  id: string;
  description: string;
  assignee?: string | null;
  deadline?: string | null;
  completed: boolean;
}

interface ActionItemsEditorProps {
  sessionId: string;
  initialItems?: ActionItem[];
  isProcessing?: boolean;
}

export function ActionItemsEditor({
  sessionId,
  initialItems = [],
  isProcessing = false,
}: ActionItemsEditorProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(true);
  const [actionItems, setActionItems] = useState<ActionItem[]>(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [newItemText, setNewItemText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState<string | null>(null);

  // Sync items when prop changes
  useEffect(() => {
    setActionItems(initialItems);
  }, [initialItems]);

  const handleToggleComplete = async (item: ActionItem) => {
    const newCompleted = !item.completed;

    // Optimistic update
    setActionItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completed: newCompleted } : i))
    );

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/action-items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: newCompleted }),
        }
      );

      if (!response.ok) throw new Error("Failed to update");
    } catch {
      // Revert on error
      setActionItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, completed: !newCompleted } : i))
      );
      toast.error("Failed to update action item");
    }
  };

  const handleStartEdit = (item: ActionItem) => {
    setEditingId(item.id);
    setEditingText(item.description);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingText("");
  };

  const handleSaveEdit = async (item: ActionItem) => {
    if (!editingText.trim()) {
      handleCancelEdit();
      return;
    }

    setIsSaving(item.id);

    // Optimistic update
    const oldDescription = item.description;
    setActionItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, description: editingText } : i))
    );
    setEditingId(null);

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/action-items/${item.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: editingText }),
        }
      );

      if (!response.ok) throw new Error("Failed to update");
      toast.success("Action item updated");
    } catch {
      // Revert on error
      setActionItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, description: oldDescription } : i))
      );
      toast.error("Failed to update action item");
    } finally {
      setIsSaving(null);
      setEditingText("");
    }
  };

  const handleDelete = async (item: ActionItem) => {
    setIsSaving(item.id);

    // Optimistic update
    setActionItems((prev) => prev.filter((i) => i.id !== item.id));

    try {
      const response = await fetch(
        `/api/sessions/${sessionId}/action-items/${item.id}`,
        { method: "DELETE" }
      );

      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Action item deleted");
    } catch {
      // Revert on error - refetch items
      setActionItems((prev) => [...prev, item]);
      toast.error("Failed to delete action item");
    } finally {
      setIsSaving(null);
    }
  };

  const handleAddItem = async () => {
    if (!newItemText.trim()) return;

    setIsAdding(true);

    try {
      const response = await fetch(`/api/sessions/${sessionId}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newItemText }),
      });

      if (!response.ok) throw new Error("Failed to add");

      const data = await response.json();
      setActionItems((prev) => [...prev, data.actionItem]);
      setNewItemText("");
      toast.success("Action item added");
    } catch {
      toast.error("Failed to add action item");
    } finally {
      setIsAdding(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, item?: ActionItem) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (item) {
        handleSaveEdit(item);
      } else {
        handleAddItem();
      }
    } else if (e.key === "Escape") {
      if (item) {
        handleCancelEdit();
      } else {
        setNewItemText("");
      }
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ListTodo className="h-4 w-4" />
                <CardTitle className="text-sm">{t("meeting.actions")}</CardTitle>
                {actionItems.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({actionItems.filter((i) => i.completed).length}/{actionItems.length})
                  </span>
                )}
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
          <CardContent className="pt-0 space-y-3">
            {isProcessing ? (
              <p className="text-muted-foreground text-center py-4 text-sm">
                {t("meeting.summaryWillBeGenerated")}
              </p>
            ) : (
              <>
                {/* Action Items List */}
                {actionItems.length > 0 ? (
                  <ul className="space-y-2">
                    {actionItems.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-start gap-2 group"
                      >
                        <button
                          onClick={() => handleToggleComplete(item)}
                          className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
                          disabled={isSaving === item.id}
                        >
                          {item.completed ? (
                            <CheckSquare className="h-4 w-4 text-green-500" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>

                        {editingId === item.id ? (
                          <div className="flex-1 flex items-center gap-1">
                            <Input
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, item)}
                              className="h-7 text-sm flex-1"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSaveEdit(item)}
                              className="h-7 px-2"
                              disabled={isSaving === item.id}
                            >
                              <Check className="h-3.5 w-3.5 text-green-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={handleCancelEdit}
                              className="h-7 px-2"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span
                              className={`text-sm flex-1 ${
                                item.completed
                                  ? "line-through text-muted-foreground"
                                  : ""
                              }`}
                            >
                              {item.description}
                            </span>
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleStartEdit(item)}
                                className="h-6 px-1.5"
                                disabled={isSaving === item.id}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(item)}
                                className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                                disabled={isSaving === item.id}
                              >
                                {isSaving === item.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    No action items yet
                  </p>
                )}

                {/* Add New Item */}
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e)}
                    placeholder="Add action item..."
                    className="h-8 text-sm flex-1"
                    disabled={isAdding}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                    disabled={!newItemText.trim() || isAdding}
                    className="h-8"
                  >
                    {isAdding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
