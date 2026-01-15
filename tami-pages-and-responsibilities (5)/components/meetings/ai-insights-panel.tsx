"use client"

import { useState } from "react"
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

interface Decision {
  id: string
  text: string
}

interface Task {
  id: string
  task: string
  assignee: string
  dueDate: string
}

interface Participant {
  id: string
  name: string
  role: string
}

interface Insights {
  summary: string
  decisions: Decision[]
  tasks: Task[]
  participants: Participant[]
}

interface AIInsightsPanelProps {
  insights: Insights
  onDecisionsChange?: (decisions: Decision[]) => void
  onTasksChange?: (tasks: Task[]) => void
  onParticipantsChange?: (participants: Participant[]) => void
}

export function AIInsightsPanel({
  insights,
  onDecisionsChange,
  onTasksChange,
  onParticipantsChange,
}: AIInsightsPanelProps) {
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null)
  const [editingDecisionText, setEditingDecisionText] = useState("")
  const [newDecision, setNewDecision] = useState("")
  const [showNewDecision, setShowNewDecision] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ task: "", assignee: "", dueDate: "" })

  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null)
  const [editingParticipantName, setEditingParticipantName] = useState("")
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeSource, setMergeSource] = useState<Participant | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string>("")

  const toggleTask = (id: string) => {
    setCompletedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
  }

  const handleAddDecision = () => {
    if (newDecision.trim() && onDecisionsChange) {
      onDecisionsChange([...insights.decisions, { id: `d${Date.now()}`, text: newDecision.trim() }])
      setNewDecision("")
      setShowNewDecision(false)
    }
  }

  const handleEditDecision = (decision: Decision) => {
    setEditingDecisionId(decision.id)
    setEditingDecisionText(decision.text)
  }

  const handleSaveDecision = () => {
    if (editingDecisionText.trim() && onDecisionsChange) {
      onDecisionsChange(
        insights.decisions.map((d) => (d.id === editingDecisionId ? { ...d, text: editingDecisionText.trim() } : d)),
      )
      setEditingDecisionId(null)
      setEditingDecisionText("")
    }
  }

  const handleDeleteDecision = (id: string) => {
    if (onDecisionsChange) {
      onDecisionsChange(insights.decisions.filter((d) => d.id !== id))
    }
  }

  const handleAddTask = () => {
    if (newTask.task.trim() && onTasksChange) {
      onTasksChange([...insights.tasks, { id: `t${Date.now()}`, ...newTask }])
      setNewTask({ task: "", assignee: "", dueDate: "" })
      setShowNewTask(false)
    }
  }

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id)
    setEditingTask({ ...task })
  }

  const handleSaveTask = () => {
    if (editingTask && editingTask.task.trim() && onTasksChange) {
      onTasksChange(insights.tasks.map((t) => (t.id === editingTaskId ? editingTask : t)))
      setEditingTaskId(null)
      setEditingTask(null)
    }
  }

  const handleDeleteTask = (id: string) => {
    if (onTasksChange) {
      onTasksChange(insights.tasks.filter((t) => t.id !== id))
    }
  }

  const handleEditParticipant = (participant: Participant) => {
    setEditingParticipantId(participant.id)
    setEditingParticipantName(participant.name)
  }

  const handleSaveParticipant = () => {
    if (editingParticipantName.trim() && onParticipantsChange) {
      onParticipantsChange(
        insights.participants.map((p) =>
          p.id === editingParticipantId ? { ...p, name: editingParticipantName.trim() } : p,
        ),
      )
      setEditingParticipantId(null)
      setEditingParticipantName("")
    }
  }

  const handleDeleteParticipant = (id: string) => {
    if (onParticipantsChange) {
      onParticipantsChange(insights.participants.filter((p) => p.id !== id))
    }
  }

  const handleOpenMerge = (participant: Participant) => {
    setMergeSource(participant)
    setMergeTarget("")
    setShowMergeDialog(true)
  }

  const handleMergeParticipants = () => {
    if (mergeSource && mergeTarget && onParticipantsChange) {
      // Remove the source participant (merge into target)
      onParticipantsChange(insights.participants.filter((p) => p.id !== mergeSource.id))
      setShowMergeDialog(false)
      setMergeSource(null)
      setMergeTarget("")
    }
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
              סיכום
            </TabsTrigger>
            <TabsTrigger
              value="decisions"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent px-3 py-3 text-sm"
            >
              <ListChecks className="w-4 h-4 ml-1" />
              החלטות
            </TabsTrigger>
            <TabsTrigger
              value="tasks"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent px-3 py-3 text-sm"
            >
              <CheckSquare className="w-4 h-4 ml-1" />
              משימות
            </TabsTrigger>
            <TabsTrigger
              value="participants"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent px-3 py-3 text-sm whitespace-nowrap"
            >
              <Users className="w-4 h-4 ml-1" />
              דוברים
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto">
          <TabsContent value="summary" className="m-0 p-4">
            <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="secondary" className="bg-teal-100 text-teal-700 hover:bg-teal-100">
                  AI סיכום
                </Badge>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{insights.summary}</p>
            </div>
          </TabsContent>

          <TabsContent value="decisions" className="m-0 p-4">
            <div className="space-y-3">
              {insights.decisions.map((decision, index) => (
                <div key={decision.id} className="flex gap-3 p-3 bg-muted/50 rounded-lg group">
                  <div className="w-6 h-6 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center flex-shrink-0 text-sm font-medium">
                    {index + 1}
                  </div>
                  {editingDecisionId === decision.id ? (
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
                        onClick={() => setEditingDecisionId(null)}
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-foreground flex-1">{decision.text}</p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => handleEditDecision(decision)}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-600 hover:text-red-700"
                          onClick={() => handleDeleteDecision(decision.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}

              {showNewDecision ? (
                <div className="flex gap-2 p-3 bg-muted/50 rounded-lg">
                  <Input
                    value={newDecision}
                    onChange={(e) => setNewDecision(e.target.value)}
                    placeholder="הוסף החלטה חדשה..."
                    className="flex-1 text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddDecision()
                      if (e.key === "Escape") setShowNewDecision(false)
                    }}
                  />
                  <Button size="sm" onClick={handleAddDecision}>
                    הוסף
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewDecision(false)}>
                    ביטול
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full gap-2 bg-transparent"
                  onClick={() => setShowNewDecision(true)}
                >
                  <Plus className="w-4 h-4" />
                  הוסף החלטה
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="m-0 p-4">
            <div className="space-y-3">
              {insights.tasks.map((task) => (
                <div
                  key={task.id}
                  className={`p-3 rounded-lg border transition-colors group ${completedTasks.has(task.id) ? "bg-muted/30 border-muted" : "bg-white border-border"}`}
                >
                  {editingTaskId === task.id && editingTask ? (
                    <div className="space-y-2">
                      <Input
                        value={editingTask.task}
                        onChange={(e) => setEditingTask({ ...editingTask, task: e.target.value })}
                        placeholder="משימה"
                        className="text-sm"
                      />
                      <div className="flex gap-2">
                        <Input
                          value={editingTask.assignee}
                          onChange={(e) => setEditingTask({ ...editingTask, assignee: e.target.value })}
                          placeholder="אחראי"
                          className="text-sm flex-1"
                        />
                        <Input
                          type="date"
                          value={editingTask.dueDate}
                          onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                          className="text-sm w-40"
                          dir="ltr"
                        />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button size="sm" onClick={handleSaveTask}>
                          שמור
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingTaskId(null)}>
                          ביטול
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={completedTasks.has(task.id)}
                        onCheckedChange={() => toggleTask(task.id)}
                        className="mt-0.5"
                      />
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${completedTasks.has(task.id) ? "line-through text-muted-foreground" : "text-foreground"}`}
                        >
                          {task.task}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {task.assignee}
                          </span>
                          <span className="flex items-center gap-1" dir="ltr">
                            <Calendar className="w-3 h-3" />
                            {task.dueDate}
                          </span>
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

              {showNewTask ? (
                <div className="p-3 rounded-lg border border-border space-y-2">
                  <Input
                    value={newTask.task}
                    onChange={(e) => setNewTask({ ...newTask, task: e.target.value })}
                    placeholder="משימה חדשה"
                    className="text-sm"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Input
                      value={newTask.assignee}
                      onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                      placeholder="אחראי"
                      className="text-sm flex-1"
                    />
                    <Input
                      type="date"
                      value={newTask.dueDate}
                      onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                      className="text-sm w-40"
                      dir="ltr"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" onClick={handleAddTask}>
                      הוסף
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNewTask(false)}>
                      ביטול
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" className="w-full gap-2 bg-transparent" onClick={() => setShowNewTask(true)}>
                  <Plus className="w-4 h-4" />
                  הוסף משימה
                </Button>
              )}
            </div>
          </TabsContent>

          <TabsContent value="participants" className="m-0 p-4">
            <div className="space-y-3">
              {insights.participants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-teal-100 text-teal-700">
                      {getInitials(participant.name)}
                    </AvatarFallback>
                  </Avatar>
                  {editingParticipantId === participant.id ? (
                    <div className="flex-1 flex items-center gap-2">
                      <Input
                        value={editingParticipantName}
                        onChange={(e) => setEditingParticipantName(e.target.value)}
                        className="flex-1 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveParticipant()
                          if (e.key === "Escape") setEditingParticipantId(null)
                        }}
                      />
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleSaveParticipant}>
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => setEditingParticipantId(null)}
                      >
                        <X className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{participant.name}</p>
                        <p className="text-xs text-muted-foreground">{participant.role}</p>
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
                          <DropdownMenuItem onClick={() => handleEditParticipant(participant)}>
                            <Pencil className="w-4 h-4 ml-2" />
                            שנה שם
                          </DropdownMenuItem>
                          {insights.participants.length > 1 && (
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <GitMerge className="w-4 h-4 ml-2" />
                                מזג עם דובר אחר
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {insights.participants
                                  .filter((p) => p.id !== participant.id)
                                  .map((p) => (
                                    <DropdownMenuItem
                                      key={p.id}
                                      onClick={() => {
                                        setMergeSource(participant)
                                        setMergeTarget(p.id)
                                        setShowMergeDialog(true)
                                      }}
                                    >
                                      {p.name}
                                    </DropdownMenuItem>
                                  ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteParticipant(participant.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="w-4 h-4 ml-2" />
                            מחק דובר
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
            <DialogTitle>מיזוג דוברים</DialogTitle>
            <DialogDescription>
              כל ההופעות של &quot;{mergeSource?.name}&quot; ימוזגו לתוך &quot;
              {insights.participants.find((p) => p.id === mergeTarget)?.name}&quot;. פעולה זו אינה ניתנת לביטול.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              ביטול
            </Button>
            <Button onClick={handleMergeParticipants} className="bg-teal-600 hover:bg-teal-700">
              מזג
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
