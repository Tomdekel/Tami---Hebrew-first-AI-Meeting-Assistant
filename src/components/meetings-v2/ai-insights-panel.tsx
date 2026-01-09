"use client"

import { useState } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
  FileText,
  ListChecks,
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

  // Format deadline date based on locale
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

  // Decision editing state
  const [editingDecisionIndex, setEditingDecisionIndex] = useState<number | null>(null)
  const [editingDecisionText, setEditingDecisionText] = useState("")
  const [newDecision, setNewDecision] = useState("")
  const [showNewDecision, setShowNewDecision] = useState(false)

  // Task editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Partial<ActionItem> | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ description: "", assignee: "", deadline: "" })
  const [savingTask, setSavingTask] = useState(false)

  // Speaker editing state
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null)
  const [editingSpeakerName, setEditingSpeakerName] = useState("")
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeSource, setMergeSource] = useState<Speaker | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string>("")
  const [isMerging, setIsMerging] = useState(false)

  const decisions = summary?.decisions || []

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
  }

  // Decision handlers
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

  // Task/ActionItem handlers
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
        onActionItemsChange([...actionItems, {
          id: data.actionItem.id,
          summary_id: data.actionItem.summaryId || "",
          description: data.actionItem.description,
          assignee: data.actionItem.assignee,
          deadline: data.actionItem.deadline,
          completed: data.actionItem.completed,
          created_at: data.actionItem.createdAt,
          updated_at: data.actionItem.updatedAt,
        }])
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
    setEditingTask({
      description: task.description,
      assignee: task.assignee || "",
      deadline: task.deadline || "",
    })
  }

  const handleSaveTask = async () => {
    if (!editingTask || !editingTask.description?.trim() || !editingTaskId) return

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
          actionItems.map((ai) =>
            ai.id === editingTaskId
              ? {
                  ...ai,
                  description: editingTask.description!.trim(),
                  assignee: editingTask.assignee || null,
                  deadline: editingTask.deadline || null,
                }
              : ai
          )
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

  // Speaker handlers
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

  const handleDeleteSpeaker = async (speakerId: string) => {
    // Note: In tami-2, we don't actually delete speakers, we just merge them
    // This is a placeholder - you might want to implement differently
    toast.error(t("speakers.cannotDeleteOnlyMerge"))
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
    <div className="h-full flex flex-col bg-white">
      <Tabs defaultValue="summary" className="flex flex-col h-full">
        <div className="border-b border-border">
          <TabsList className="w-full justify-start p-0 h-auto bg-transparent rounded-none">
            <TabsTrigger
              value="summary"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent px-3 py-3 text-sm"
            >
              <FileText className="w-4 h-4 ml-1" />
              {t("meeting.summary")}
            </TabsTrigger>
            <TabsTrigger
              value="decisions"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent px-3 py-3 text-sm"
            >
              <ListChecks className="w-4 h-4 ml-1" />
              {t("meeting.decisions")}
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent px-3 py-3 text-sm"
            >
              <CheckSquare className="w-4 h-4 ml-1" />
              {t("meeting.actions")}
            </TabsTrigger>
            <TabsTrigger
              value="speakers"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent px-3 py-3 text-sm whitespace-nowrap"
            >
              <Users className="w-4 h-4 ml-1 flex-shrink-0" />
              {t("meeting.speakers")}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Summary Tab */}
          <TabsContent value="summary" className="m-0 p-4">
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
          </TabsContent>

          {/* Decisions Tab */}
          <TabsContent value="decisions" className="m-0 p-4">
            <div className="space-y-3">
              {decisions.map((decision, index) => (
                <div key={index} className="flex gap-3 p-3 bg-muted/50 rounded-lg group">
                  <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 text-sm font-medium">
                    {index + 1}
                  </div>
                  {editingDecisionIndex === index ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editingDecisionText}
                        onChange={(e) => setEditingDecisionText(e.target.value)}
                        className="flex-1 text-sm"
                        autoFocus
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSaveDecision}>
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingDecisionIndex(null)}
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-foreground flex-1">{decision.description}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEditDecision(index, decision)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
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
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm mb-2">{t("meeting.noDecisionsYet")}</p>
                </div>
              )}

              {showNewDecision ? (
                <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
                  <Input
                    value={newDecision}
                    onChange={(e) => setNewDecision(e.target.value)}
                    placeholder={t("meeting.addNewDecisionPlaceholder")}
                    className="flex-1 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddDecision()
                      if (e.key === "Escape") setShowNewDecision(false)
                    }}
                  />
                  <Button size="sm" onClick={handleAddDecision}>
                    {t("common.add")}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewDecision(false)}>
                    {t("common.cancel")}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full gap-2 bg-transparent"
                  onClick={() => setShowNewDecision(true)}
                >
                  <Plus className="w-4 h-4" />
                  {t("meeting.addDecision")}
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Tasks Tab */}
          <TabsContent value="tasks" className="m-0 p-4">
            <div className="space-y-3">
              {actionItems.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-lg border transition-colors group ${
                    task.completed ? "bg-muted/30 border-muted" : "bg-white border-border"
                  }`}
                >
                  {editingTaskId === task.id && editingTask ? (
                    <div className="space-y-2">
                      <Input
                        value={editingTask.description || ""}
                        onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                        placeholder={t("meeting.taskPlaceholder")}
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={editingTask.assignee || ""}
                          onChange={(e) => setEditingTask({ ...editingTask, assignee: e.target.value })}
                          placeholder={t("meeting.assigneePlaceholder")}
                          className="text-sm flex-1"
                        />
                        <Input
                          type="date"
                          value={editingTask.deadline || ""}
                          onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                          className="text-sm w-40"
                          dir="ltr"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={handleSaveTask} disabled={savingTask}>
                          {t("common.save")}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingTaskId(null)}>
                          {t("common.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={task.completed}
                        onCheckedChange={() => handleToggleTask(task)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${
                            task.completed ? "line-through text-muted-foreground" : "text-foreground"
                          }`}
                        >
                          {task.description}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
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
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditTask(task)}>
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteTask(task.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {actionItems.length === 0 && !showNewTask && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm mb-2">{t("meeting.noTasksYet")}</p>
                </div>
              )}

              {showNewTask ? (
                <div className="p-3 rounded-lg border border-border space-y-2">
                  <Input
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder={t("meeting.newTaskPlaceholder")}
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Input
                      value={newTask.assignee}
                      onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                      placeholder={t("meeting.assigneePlaceholder")}
                      className="text-sm flex-1"
                    />
                    <Input
                      type="date"
                      value={newTask.deadline}
                      onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                      className="text-sm w-40"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" onClick={handleAddTask} disabled={savingTask}>
                      {t("common.add")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewTask(false)}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full gap-2 bg-transparent" onClick={() => setShowNewTask(true)}>
                  <Plus className="w-4 h-4" />
                  {t("meeting.addTask")}
                </Button>
              )}
            </div>
          </TabsContent>

          {/* Speakers Tab */}
          <TabsContent value="speakers" className="m-0 p-4">
            <div className="space-y-3">
              {speakers.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">{t("meeting.noSpeakersIdentified")}</p>
                </div>
              )}

              {speakers.map((speaker) => (
                <div key={speaker.speakerId} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-teal-100 text-teal-700">
                      {getInitials(speaker.speakerName)}
                    </AvatarFallback>
                  </Avatar>
                  {editingSpeakerId === speaker.speakerId ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editingSpeakerName}
                        onChange={(e) => setEditingSpeakerName(e.target.value)}
                        className="flex-1 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveSpeaker()
                          if (e.key === "Escape") setEditingSpeakerId(null)
                        }}
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSaveSpeaker}>
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingSpeakerId(null)}
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{speaker.speakerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {speaker.segmentCount} {t("meeting.segments")}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEditSpeaker(speaker)}>
                            <Pencil className="w-4 h-4 ml-2" />
                            {t("speakers.rename")}
                          </DropdownMenuItem>
                          {speakers.length > 1 && (
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <GitMerge className="w-4 h-4 ml-2" />
                                {t("speakers.mergeWith")}
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {speakers
                                  .filter((s) => s.speakerId !== speaker.speakerId)
                                  .map((target) => (
                                    <DropdownMenuItem
                                      key={target.speakerId}
                                      onClick={() => {
                                        setMergeSource(speaker)
                                        setMergeTarget(target.speakerId)
                                        setShowMergeDialog(true)
                                      }}
                                    >
                                      {target.speakerName}
                                    </DropdownMenuItem>
                                  ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteSpeaker(speaker.speakerId)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 ml-2" />
                            {t("speakers.deleteSpeaker")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("speakers.mergeSpeakers")}</DialogTitle>
            <DialogDescription>
              {t("speakers.mergeDescription", {
                source: mergeSource?.speakerName || "",
                target: speakers.find((s) => s.speakerId === mergeTarget)?.speakerName || ""
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleMergeSpeakers}
              disabled={isMerging}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isMerging ? t("common.loading") : t("speakers.merge")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
