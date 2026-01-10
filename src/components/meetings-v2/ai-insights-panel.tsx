"use client"

import { useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CheckSquare,
  Users,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  MoreHorizontal,
  GitMerge,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ActionItem, Decision, Summary } from "@/lib/types/database"

export interface Speaker {
  speakerId: string
  speakerName: string
  segmentCount: number
}

interface AIInsightsPanelProps {
  sessionId: string
  summary: Summary | null
  speakers: Speaker[]
  actionItems: ActionItem[]
  isLoading?: boolean
  onSummaryChange?: (summary: Summary) => void
  onActionItemsChange?: (items: ActionItem[]) => void
  onSpeakersChange?: (speakers: Speaker[]) => void
  onRefresh?: () => void
}

export function AIInsightsPanel({
  sessionId,
  summary,
  speakers,
  actionItems,
  isLoading = false,
  onSummaryChange,
  onActionItemsChange,
  onSpeakersChange,
  onRefresh,
}: AIInsightsPanelProps) {
  const t = useTranslations()
  const locale = useLocale()

  const formatDeadline = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    } catch {
      return dateString
    }
  }

  const [editingDecisionIndex, setEditingDecisionIndex] = useState<number | null>(null)
  const [editingDecisionText, setEditingDecisionText] = useState("")
  const [newDecision, setNewDecision] = useState("")
  const [showNewDecision, setShowNewDecision] = useState(false)

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Partial<ActionItem> | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ description: "", assignee: "", deadline: "" })
  const [savingTask, setSavingTask] = useState(false)

  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null)
  const [editingSpeakerName, setEditingSpeakerName] = useState("")
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeSource, setMergeSource] = useState<Speaker | null>(null)
  const [mergeTarget, setMergeTarget] = useState("")
  const [isMerging, setIsMerging] = useState(false)

  const decisions = summary?.decisions || []

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
  }

  const handleAddDecision = () => {
    if (!newDecision.trim() || !summary || !onSummaryChange) return
    const newDecisions: Decision[] = [...decisions, { description: newDecision.trim(), context: null }]
    onSummaryChange({ ...summary, decisions: newDecisions })
    setNewDecision("")
    setShowNewDecision(false)
  }

  const handleEditDecision = (index: number, decision: Decision) => {
    setEditingDecisionIndex(index)
    setEditingDecisionText(decision.description)
  }

  const handleSaveDecision = () => {
    if (editingDecisionIndex === null || !editingDecisionText.trim() || !summary || !onSummaryChange) return
    const newDecisions = decisions.map((d, i) =>
      i === editingDecisionIndex ? { ...d, description: editingDecisionText.trim() } : d
    )
    onSummaryChange({ ...summary, decisions: newDecisions })
    setEditingDecisionIndex(null)
    setEditingDecisionText("")
  }

  const handleDeleteDecision = (index: number) => {
    if (!summary || !onSummaryChange) return
    const newDecisions = decisions.filter((_, i) => i !== index)
    onSummaryChange({ ...summary, decisions: newDecisions })
  }

  const handleToggleTask = async (item: ActionItem) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/action-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !item.completed }),
      })

      if (!response.ok) throw new Error("Failed to update task")

      if (onActionItemsChange) {
        onActionItemsChange(
          actionItems.map((ai) => (ai.id === item.id ? { ...ai, completed: !ai.completed } : ai))
        )
      }
    } catch {
      toast.error(t("common.error"))
    }
  }

  const handleAddTask = async () => {
    if (!newTask.description.trim()) return

    setSavingTask(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newTask.description.trim(),
          assignee: newTask.assignee || null,
          deadline: newTask.deadline || null,
        }),
      })

      if (!response.ok) throw new Error("Failed to add task")

      const data = await response.json()
      if (onActionItemsChange) {
        onActionItemsChange([
          ...actionItems,
          {
            id: data.actionItem.id,
            summary_id: data.actionItem.summaryId || "",
            description: data.actionItem.description,
            assignee: data.actionItem.assignee,
            deadline: data.actionItem.deadline,
            completed: data.actionItem.completed,
            created_at: data.actionItem.createdAt,
            updated_at: data.actionItem.updatedAt,
          },
        ])
      }

      setNewTask({ description: "", assignee: "", deadline: "" })
      setShowNewTask(false)
    } catch {
      toast.error(t("common.error"))
    } finally {
      setSavingTask(false)
    }
  }

  const handleEditTask = (task: ActionItem) => {
    setEditingTaskId(task.id)
    setEditingTask({ ...task })
  }

  const handleSaveTask = async () => {
    if (!editingTask || !editingTaskId || !editingTask.description?.trim()) return

    setSavingTask(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/action-items/${editingTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editingTask.description.trim(),
          assignee: editingTask.assignee || null,
          deadline: editingTask.deadline || null,
        }),
      })

      if (!response.ok) throw new Error("Failed to update task")

      if (onActionItemsChange) {
        onActionItemsChange(
          actionItems.map((ai) => (ai.id === editingTaskId ? { ...ai, ...editingTask } as ActionItem : ai))
        )
      }

      setEditingTaskId(null)
      setEditingTask(null)
    } catch {
      toast.error(t("common.error"))
    } finally {
      setSavingTask(false)
    }
  }

  const handleDeleteTask = async (id: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/action-items/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete task")

      if (onActionItemsChange) {
        onActionItemsChange(actionItems.filter((ai) => ai.id !== id))
      }
    } catch {
      toast.error(t("common.error"))
    }
  }

  const handleEditSpeaker = (speaker: Speaker) => {
    setEditingSpeakerId(speaker.speakerId)
    setEditingSpeakerName(speaker.speakerName)
  }

  const handleSaveSpeaker = async () => {
    if (!editingSpeakerId || !editingSpeakerName.trim()) return

    try {
      const response = await fetch(`/api/sessions/${sessionId}/speakers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerId: editingSpeakerId,
          speakerName: editingSpeakerName.trim(),
        }),
      })

      if (!response.ok) throw new Error("Failed to rename speaker")

      toast.success(t("speakers.renamed"))
      if (onSpeakersChange) {
        onSpeakersChange(
          speakers.map((s) =>
            s.speakerId === editingSpeakerId ? { ...s, speakerName: editingSpeakerName.trim() } : s
          )
        )
      }
      setEditingSpeakerId(null)
      setEditingSpeakerName("")
      onRefresh?.()
    } catch {
      toast.error(t("speakers.renameFailed"))
    }
  }

  const handleDeleteSpeaker = async (_speakerId: string) => {
    toast.error(t("speakers.cannotDeleteOnlyMerge"))
  }

  const handleOpenMerge = (speaker: Speaker) => {
    setMergeSource(speaker)
    setMergeTarget("")
    setShowMergeDialog(true)
  }

  const handleMergeSpeakers = async () => {
    if (!mergeSource || !mergeTarget) return

    setIsMerging(true)
    try {
      const targetSpeaker = speakers.find((s) => s.speakerId === mergeTarget)
      const response = await fetch(`/api/sessions/${sessionId}/speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSpeakerId: mergeSource.speakerId,
          targetSpeakerId: mergeTarget,
          targetSpeakerName: targetSpeaker?.speakerName,
        }),
      })

      if (!response.ok) throw new Error("Failed to merge speakers")

      toast.success(t("speakers.merged"), {
        description: `${mergeSource.speakerName} → ${targetSpeaker?.speakerName}`,
      })

      if (onSpeakersChange) {
        onSpeakersChange(
          speakers
            .filter((s) => s.speakerId !== mergeSource.speakerId)
            .map((s) =>
              s.speakerId === mergeTarget
                ? { ...s, segmentCount: s.segmentCount + mergeSource.segmentCount }
                : s
            )
        )
      }

      setShowMergeDialog(false)
      setMergeSource(null)
      setMergeTarget("")
      onRefresh?.()
    } catch {
      toast.error(t("speakers.mergeFailed"))
    } finally {
      setIsMerging(false)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
        <div className="lg:col-span-2">
          {summary?.overview ? (
            <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="bg-teal-100 text-teal-700 hover:bg-teal-100">
                  {t("meeting.aiGenerated")}
                </Badge>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{summary.overview}</p>
              {summary.key_points && summary.key_points.length > 0 && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">{t("meeting.keyPoints")}</h4>
                  <ul className="space-y-1">
                    {summary.key_points.map((point, index) => (
                      <li key={index} className="text-sm text-foreground flex gap-2">
                        <span className="text-teal-600">•</span>
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-muted-foreground text-sm">{t("meeting.noSummaryYet")}</p>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-amber-700" />
              </span>
              {t("meeting.decisions")}
            </h3>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowNewDecision(true)}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            {decisions.map((decision, index) => (
              <div key={index} className="flex gap-2 p-2 bg-muted/50 rounded group text-sm">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                  {index + 1}
                </span>
                {editingDecisionIndex === index ? (
                  <div className="flex-1 flex items-center gap-1">
                    <Input
                      value={editingDecisionText}
                      onChange={(e) => setEditingDecisionText(e.target.value)}
                      className="h-7 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveDecision()
                        if (e.key === "Escape") setEditingDecisionIndex(null)
                      }}
                    />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleSaveDecision}>
                      <Check className="w-3 h-3 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditingDecisionIndex(null)}>
                      <X className="w-3 h-3 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="flex-1 text-foreground">{decision.description}</p>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleEditDecision(index, decision)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-600"
                        onClick={() => handleDeleteDecision(index)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {decisions.length === 0 && !showNewDecision && (
              <div className="text-center py-2 text-sm text-muted-foreground">
                {t("meeting.noDecisionsYet")}
              </div>
            )}
            {showNewDecision && (
              <div className="flex gap-2 p-2 bg-muted/50 rounded">
                <Input
                  value={newDecision}
                  onChange={(e) => setNewDecision(e.target.value)}
                  placeholder={t("meeting.addNewDecisionPlaceholder")}
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddDecision()
                    if (e.key === "Escape") setShowNewDecision(false)
                  }}
                />
                <Button size="sm" className="h-8" onClick={handleAddDecision}>
                  {t("common.add")}
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowNewDecision(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <span className="w-6 h-6 rounded bg-green-100 flex items-center justify-center">
                <CheckSquare className="w-3.5 h-3.5 text-green-700" />
              </span>
              {t("meeting.actions")}
            </h3>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setShowNewTask(true)}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-2">
            {actionItems.map((task) => (
              <div key={task.id} className="flex gap-2 p-2 bg-muted/50 rounded group text-sm">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => handleToggleTask(task)}
                  className="mt-0.5"
                />
                {editingTaskId === task.id ? (
                  <div className="flex-1 space-y-2">
                    <Input
                      value={editingTask?.description || ""}
                      onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                      className="text-sm h-8"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Input
                        value={editingTask?.assignee || ""}
                        onChange={(e) => setEditingTask({ ...editingTask, assignee: e.target.value })}
                        placeholder={t("meeting.assignedTo")}
                        className="text-xs flex-1 h-8"
                      />
                      <Input
                        type="date"
                        value={editingTask?.deadline || ""}
                        onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                        className="text-xs w-32 h-8"
                        dir="ltr"
                      />
                    </div>
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" className="h-7" onClick={handleSaveTask} disabled={savingTask}>
                        {savingTask ? t("common.loading") : t("common.save")}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingTaskId(null)}>
                        {t("common.cancel")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className={cn("text-foreground", task.completed ? "line-through text-muted-foreground" : "")}>
                        {task.description}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {task.assignee && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {task.assignee}
                          </span>
                        )}
                        {task.deadline && (
                          <span className="flex items-center gap-1" dir="ltr">
                            <Calendar className="w-3 h-3" />
                            {formatDeadline(task.deadline)}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => handleEditTask(task)}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-red-600"
                        onClick={() => handleDeleteTask(task.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {actionItems.length === 0 && !showNewTask && (
              <div className="text-center py-2 text-sm text-muted-foreground">
                {t("meeting.noTasksYet")}
              </div>
            )}
            {showNewTask && (
              <div className="p-2 rounded border border-border space-y-2">
                <Input
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder={t("meeting.addNewTaskPlaceholder")}
                  className="text-sm h-8"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Input
                    value={newTask.assignee}
                    onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                    placeholder={t("meeting.assignedTo")}
                    className="text-sm flex-1 h-8"
                  />
                  <Input
                    type="date"
                    value={newTask.deadline}
                    onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                    className="text-sm w-32 h-8"
                    dir="ltr"
                  />
                </div>
                <div className="flex gap-1 justify-end">
                  <Button size="sm" className="h-7" onClick={handleAddTask} disabled={savingTask}>
                    {savingTask ? t("common.loading") : t("common.add")}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowNewTask(false)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-border p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-purple-700" />
            </span>
            <h3 className="font-medium text-sm">{t("meeting.speakers")}</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {speakers.map((speaker) => (
              <div key={speaker.speakerId} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg group">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                    {getInitials(speaker.speakerName)}
                  </AvatarFallback>
                </Avatar>
                {editingSpeakerId === speaker.speakerId ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editingSpeakerName}
                      onChange={(e) => setEditingSpeakerName(e.target.value)}
                      className="w-28 h-7 text-sm"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveSpeaker()
                        if (e.key === "Escape") setEditingSpeakerId(null)
                      }}
                    />
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleSaveSpeaker}>
                      <Check className="w-3 h-3 text-green-600" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div>
                      <p className="text-sm font-medium">{speaker.speakerName}</p>
                      <p className="text-xs text-muted-foreground">
                        {speaker.segmentCount} {t("meeting.segments")}
                      </p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEditSpeaker(speaker)}>
                          <Pencil className="w-3 h-3 mr-2" />
                          {t("speakers.rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleOpenMerge(speaker)}>
                          <GitMerge className="w-3 h-3 mr-2" />
                          {t("speakers.merge")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleDeleteSpeaker(speaker.speakerId)} className="text-red-600">
                          <Trash2 className="w-3 h-3 mr-2" />
                          {t("common.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            ))}
            {speakers.length === 0 && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                {t("meeting.noSpeakersYet")}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("speakers.mergeTitle")}</DialogTitle>
            <DialogDescription>{t("speakers.mergeDescription")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">{t("speakers.sourceSpeaker")}</label>
              <div className="mt-2 flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className="text-xs">{mergeSource ? getInitials(mergeSource.speakerName) : ""}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{mergeSource?.speakerName}</span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t("speakers.targetSpeaker")}</label>
              <select
                className="mt-2 w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
              >
                <option value="">{t("speakers.selectTarget")}</option>
                {speakers
                  .filter((s) => s.speakerId !== mergeSource?.speakerId)
                  .map((speaker) => (
                    <option key={speaker.speakerId} value={speaker.speakerId}>
                      {speaker.speakerName}
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleMergeSpeakers} disabled={!mergeTarget || isMerging}>
              {isMerging ? t("common.loading") : t("speakers.merge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
