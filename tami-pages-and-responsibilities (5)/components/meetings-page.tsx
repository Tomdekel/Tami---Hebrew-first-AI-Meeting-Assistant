"use client"

import { useState, useEffect } from "react"
import { MeetingsSidebar } from "@/components/meetings/meetings-sidebar"
import { TranscriptPanel } from "@/components/meetings/transcript-panel"
import { AudioPlayer } from "@/components/meetings/audio-player"
import { MeetingChat } from "@/components/meetings/meeting-chat"
import { DocumentsPanel } from "@/components/meetings/documents-panel"
import { ProcessingStepper, type ProcessingStage } from "@/components/processing-stepper"
import { StatusEmptyState } from "@/components/status-empty-state"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent } from "@/components/ui/sheet"
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
  MessageSquare,
  FileText,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  Download,
  Info,
  ChevronLeft,
  ChevronRight,
  Plus,
  Check,
  Calendar,
  Users,
  GitMerge,
  Loader2,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"

interface Meeting {
  id: string
  title: string
  date: string
  time: string
  duration: string
  participants: string[]
  status: "completed" | "processing" | "draft" | "failed"
  processingStage?: ProcessingStage
  context: string
  source?: "audio" | "transcript" | "live" | "calendar"
}

const sampleMeetings: Meeting[] = [
  {
    id: "1",
    title: "סיכום פגישת פיתוח Q4",
    date: "2024-01-07",
    time: "14:00",
    duration: "45 דקות",
    participants: ["דני כהן", "מיכל לוי", "יוסי אברהם"],
    status: "completed",
    context: "פגישה בין בן ומאיה על יוזמת שיווק חדשה בגרמניה. אני מציג גישת גרילה מרקטינג ל-CMO.",
    source: "audio",
  },
  {
    id: "2",
    title: "תכנון ספרינט 12",
    date: "2024-01-06",
    time: "10:00",
    duration: "30 דקות",
    participants: ["דני כהן", "רונית שפירא"],
    status: "completed",
    context: "",
    source: "live",
  },
  {
    id: "3",
    title: "פגישת סטטוס עם הלקוח",
    date: "2024-01-05",
    time: "16:00",
    duration: "60 דקות",
    participants: ["דני כהן", "מיכל לוי", "אבי גולדשטיין"],
    status: "processing",
    processingStage: "summarizing",
    context: "",
    source: "transcript",
  },
  {
    id: "4",
    title: "דיון אסטרטגיה שיווקית",
    date: "2024-01-04",
    time: "11:00",
    duration: "50 דקות",
    participants: ["דני כהן", "שרה מזרחי", "תום ברק"],
    status: "failed",
    context: "",
    source: "audio",
  },
]

const sampleTranscript = [
  { speakerId: "speaker-1", time: "00:01", text: "היי, איך אפשר לעזור?" },
  { speakerId: "speaker-2", time: "00:02", text: "אני צריך לתרום על הפרויקט." },
  { speakerId: "speaker-3", time: "00:03", text: "אני אעשה את זה בהקדם." },
]

const sampleSummary = {
  summary: `בפגישה נדונה התקדמות הפיתוח ברבעון הרביעי. מודול ההתראות הושלם ונמצא בשלב הבדיקות, עם צפי לסיום תוך 2-3 ימים. זוהתה בעיה באינטגרציה עם ה-API של הלקוח עקב שינוי בפורמט האימות שלא תואם מראש.`,
  decisions: [
    { id: "d1", text: "מיכל תמשיך לעבוד על תיקון בעיית האימות ב-API" },
    { id: "d2", text: "יוסי יסיים את הבדיקות תוך 2-3 ימים ואז יסייע לאינטגרציה" },
    { id: "d3", text: "דני יעדכן את הלקוח על הסטטוס הנוכחי" },
  ],
  tasks: [
    { id: "t1", task: "תיקון בעיית אימות API", assignee: "מיכל לוי", dueDate: "2024-01-09" },
    { id: "t2", task: "השלמת בדיקות מודול התראות", assignee: "יוסי אברהם", dueDate: "2024-01-10" },
    { id: "t3", task: "עדכון סטטוס ללקוח", assignee: "דני כהן", dueDate: "2024-01-08" },
  ],
  participants: [
    { id: "speaker-1", name: "דני כהן", role: "מנהל פרויקט" },
    { id: "speaker-2", name: "דובר 2", role: "" },
    { id: "speaker-3", name: "דובר 3", role: "" },
  ],
}

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

export function MeetingsPage() {
  const { isRTL } = useLanguage()
  const { toast } = useToast()
  const [selectedMeetingId, setSelectedMeetingId] = useState("1")
  const [showChat, setShowChat] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [showTranscript, setShowTranscript] = useState(true)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [showMobileTranscript, setShowMobileTranscript] = useState(false)
  const [speakerNames, setSpeakerNames] = useState<Record<string, string>>({
    "speaker-1": "דני כהן",
    "speaker-2": "דובר 2",
    "speaker-3": "דובר 3",
  })
  const [meetings, setMeetings] = useState(sampleMeetings)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState("")
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [decisions, setDecisions] = useState(sampleSummary.decisions)
  const [tasks, setTasks] = useState(sampleSummary.tasks)
  const [participants, setParticipants] = useState(sampleSummary.participants)
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  const [loadedSections, setLoadedSections] = useState({
    summary: false,
    decisions: false,
    tasks: false,
    speakers: false,
  })

  const [hasShownSpeakerToast, setHasShownSpeakerToast] = useState(false)

  useEffect(() => {
    const meeting = meetings.find((m) => m.id === selectedMeetingId)
    if (meeting?.status === "completed") {
      setLoadedSections({ summary: false, decisions: false, tasks: false, speakers: false })
      // Progressive reveal
      setTimeout(() => setLoadedSections((prev) => ({ ...prev, summary: true })), 300)
      setTimeout(() => setLoadedSections((prev) => ({ ...prev, decisions: true })), 600)
      setTimeout(() => setLoadedSections((prev) => ({ ...prev, tasks: true })), 900)
      setTimeout(() => setLoadedSections((prev) => ({ ...prev, speakers: true })), 1200)
    }
  }, [selectedMeetingId, meetings])

  // Editing states for inline editing
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

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId)
  const isProcessing = selectedMeeting?.status === "processing"
  const isFailed = selectedMeeting?.status === "failed"
  const isDraft = selectedMeeting?.status === "draft"

  const handleSpeakerNameChange = (speakerId: string, newName: string) => {
    setSpeakerNames((prev) => ({ ...prev, [speakerId]: newName }))
  }

  const transcriptWithNames = sampleTranscript.map((item) => ({
    ...item,
    speaker: speakerNames[item.speakerId] || item.speaker,
  }))

  const handleStartEditTitle = () => {
    if (selectedMeeting) {
      setTitleValue(selectedMeeting.title)
      setEditingTitle(true)
    }
  }

  const handleSaveTitle = () => {
    if (titleValue.trim() && selectedMeeting) {
      setMeetings((prev) => prev.map((m) => (m.id === selectedMeeting.id ? { ...m, title: titleValue.trim() } : m)))
      setEditingTitle(false)
    }
  }

  const handleDeleteMeeting = () => {
    setMeetings((prev) => prev.filter((m) => m.id !== selectedMeetingId))
    const remainingMeetings = meetings.filter((m) => m.id !== selectedMeetingId)
    if (remainingMeetings.length > 0) {
      setSelectedMeetingId(remainingMeetings[0].id)
    }
    setShowDeleteDialog(false)
  }

  const handleDownloadTranscript = () => {
    const transcriptText = transcriptWithNames
      .map((item) => `[${item.time}] ${item.speaker}: ${item.text}`)
      .join("\n\n")

    const blob = new Blob([transcriptText], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${selectedMeeting?.title || "transcript"}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

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

  // Decision handlers
  const handleAddDecision = () => {
    if (newDecision.trim()) {
      setDecisions([...decisions, { id: `d${Date.now()}`, text: newDecision.trim() }])
      setNewDecision("")
      setShowNewDecision(false)
    }
  }

  const handleEditDecision = (decision: Decision) => {
    setEditingDecisionId(decision.id)
    setEditingDecisionText(decision.text)
  }

  const handleSaveDecision = () => {
    if (editingDecisionText.trim()) {
      setDecisions(decisions.map((d) => (d.id === editingDecisionId ? { ...d, text: editingDecisionText.trim() } : d)))
      setEditingDecisionId(null)
      setEditingDecisionText("")
    }
  }

  const handleDeleteDecision = (id: string) => {
    setDecisions(decisions.filter((d) => d.id !== id))
  }

  // Task handlers
  const handleAddTask = () => {
    if (newTask.task.trim()) {
      setTasks([...tasks, { id: `t${Date.now()}`, ...newTask }])
      setNewTask({ task: "", assignee: "", dueDate: "" })
      setShowNewTask(false)
    }
  }

  const handleEditTask = (task: Task) => {
    setEditingTaskId(task.id)
    setEditingTask({ ...task })
  }

  const handleSaveTask = () => {
    if (editingTask && editingTask.task.trim()) {
      setTasks(tasks.map((t) => (t.id === editingTaskId ? editingTask : t)))
      setEditingTaskId(null)
      setEditingTask(null)
    }
  }

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter((t) => t.id !== id))
  }

  // Participant handlers
  const handleEditParticipant = (participant: Participant) => {
    setEditingParticipantId(participant.id)
    setEditingParticipantName(participant.name)
  }

  const handleSaveParticipant = () => {
    if (editingParticipantName.trim()) {
      const currentParticipant = participants.find((p) => p.id === editingParticipantId)
      const wasUnnamed = currentParticipant?.name.startsWith("Speaker") || currentParticipant?.name.startsWith("דובר")

      setParticipants(
        participants.map((p) => (p.id === editingParticipantId ? { ...p, name: editingParticipantName.trim() } : p)),
      )
      setSpeakerNames((prev) => ({
        ...prev,
        [editingParticipantId!]: editingParticipantName.trim(),
      }))
      setEditingParticipantId(null)
      setEditingParticipantName("")

      // Show toast on first speaker named
      if (wasUnnamed && !hasShownSpeakerToast) {
        toast({
          title: isRTL ? "שם דובר הוקצאת" : "Speaker Named",
          description: isRTL
            ? "תוכל לחפש ולהציג תובנות מדויקות יותר"
            : "You can now search and display insights more accurately.",
          variant: "default",
        })
        setHasShownSpeakerToast(true)
      }
    }
  }

  const handleDeleteParticipant = (id: string) => {
    setParticipants(participants.filter((p) => p.id !== id))
  }

  const handleOpenMerge = (participant: Participant) => {
    setMergeSource(participant)
    setMergeTarget("")
    setShowMergeDialog(true)
  }

  const handleMergeParticipants = () => {
    if (mergeSource && mergeTarget) {
      setParticipants(participants.filter((p) => p.id !== mergeSource.id))
      setShowMergeDialog(false)
      setMergeSource(null)
      setMergeTarget("")
    }
  }

  const handleRetryProcessing = () => {
    if (selectedMeeting) {
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === selectedMeeting.id
            ? { ...m, status: "processing" as const, processingStage: "uploading" as ProcessingStage }
            : m,
        ),
      )
    }
  }

  // Count unnamed speakers
  const unnamedSpeakers = participants.filter((p) => p.name.startsWith("Speaker") || p.name.startsWith("דובר")).length
  const hasUnnamedSpeakers = unnamedSpeakers > 0

  return (
    <div className="flex h-[calc(100vh-3.5rem)]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Mobile Transcript Sheet */}
      <Sheet open={showMobileTranscript} onOpenChange={setShowMobileTranscript}>
        <SheetContent side="right" className="w-80 p-0">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-medium text-sm">{isRTL ? "תמליל" : "Transcript"}</h3>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowMobileTranscript(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {isProcessing ? (
                <StatusEmptyState status="processing" section={isRTL ? "התמליל" : "Transcript"} />
              ) : (
                <TranscriptPanel
                  transcript={transcriptWithNames}
                  speakerNames={speakerNames}
                  onSpeakerNameChange={handleSpeakerNameChange}
                />
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Meetings Sidebar Sheet */}
      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent side="left" className="w-80 p-0">
          <MeetingsSidebar
            meetings={meetings}
            selectedId={selectedMeetingId}
            onSelect={(id) => {
              setSelectedMeetingId(id)
              setShowMobileSidebar(false)
            }}
            onRetry={handleRetryProcessing}
          />
        </SheetContent>
      </Sheet>

      <div className="hidden md:block w-80 flex-shrink-0 border-e border-border">
        <MeetingsSidebar
          meetings={meetings}
          selectedId={selectedMeetingId}
          onSelect={setSelectedMeetingId}
          onRetry={handleRetryProcessing}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Meeting Header */}
        {selectedMeeting && (
          <div className="border-b border-border bg-white px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {/* Mobile toggles - updated to match new sidebar positions */}
                <div className="flex items-center gap-2 mb-2 md:hidden">
                  <Button variant="ghost" size="sm" onClick={() => setShowMobileSidebar(true)}>
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-xs">{isRTL ? "פגישות" : "Meetings"}</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowMobileTranscript(true)}>
                    <span className="text-xs">{isRTL ? "תמליל" : "Transcript"}</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2 group flex-wrap">
                  {editingTitle ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input
                        value={titleValue}
                        onChange={(e) => setTitleValue(e.target.value)}
                        className="text-lg md:text-xl font-semibold h-9 max-w-full sm:max-w-md"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveTitle()
                          if (e.key === "Escape") setEditingTitle(false)
                        }}
                      />
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={handleSaveTitle}>
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => setEditingTitle(false)}
                      >
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-lg md:text-xl font-semibold text-foreground line-clamp-1">
                        {selectedMeeting.title}
                      </h1>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={handleStartEditTitle}
                      >
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 md:gap-4 mt-1 text-xs md:text-sm text-muted-foreground flex-wrap">
                  <span>{selectedMeeting.date}</span>
                  <span>{selectedMeeting.time}</span>
                  <span className="hidden sm:inline">{selectedMeeting.duration}</span>
                  <span>
                    {selectedMeeting.participants.length} {isRTL ? "משתתפים" : "participants"}
                  </span>
                </div>
                {selectedMeeting.context && (
                  <div className="mt-2 flex items-start gap-2">
                    <Badge variant="secondary" className="text-xs bg-teal-50 text-teal-700 shrink-0">
                      <Info className="w-3 h-3 mr-1" />
                      {isRTL ? "הקשר" : "Context"}
                    </Badge>
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{selectedMeeting.context}</p>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadTranscript}
                  disabled={isProcessing || isFailed}
                  className="hidden sm:flex bg-transparent"
                >
                  <Download className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                  <span className="hidden lg:inline">{isRTL ? "הורד" : "Download"}</span>
                </Button>
                <Button
                  variant={showDocuments ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDocuments(!showDocuments)}
                  className={showDocuments ? "bg-teal-600 hover:bg-teal-700" : ""}
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden lg:inline ml-2">{isRTL ? "מסמכים" : "Docs"}</span>
                </Button>
                <Button
                  variant={showChat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                  className={showChat ? "bg-teal-600 hover:bg-teal-700" : ""}
                  disabled={isProcessing || isFailed}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden lg:inline ml-2">{isRTL ? "צ׳אט" : "Chat"}</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={handleDownloadTranscript}
                      disabled={isProcessing || isFailed}
                      className="sm:hidden"
                    >
                      <Download className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                      {isRTL ? "הורד תמליל" : "Download transcript"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                      {isRTL ? "מחק פגישה" : "Delete meeting"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        )}

        {selectedMeeting && isProcessing && selectedMeeting.processingStage && (
          <Card className="mx-4 md:mx-6 mt-4 border-teal-200 bg-teal-50/50">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center gap-3 mb-3">
                <Loader2 className="w-5 h-5 text-teal-600 animate-spin" />
                <div>
                  <h3 className="font-medium text-teal-800">
                    {isRTL ? "הפגישה בעיבוד" : "Meeting is being processed"}
                  </h3>
                  <p className="text-sm text-teal-700">
                    {isRTL
                      ? "תמי הופכת את השיחה לידע מובנה"
                      : "Tami is turning this conversation into structured knowledge"}
                  </p>
                </div>
              </div>
              <ProcessingStepper currentStage={selectedMeeting.processingStage} source={selectedMeeting.source} />
            </CardContent>
          </Card>
        )}

        {selectedMeeting && isFailed && (
          <Card className="mx-4 md:mx-6 mt-4 border-red-200 bg-red-50/50">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <div>
                    <h3 className="font-medium text-red-800">{isRTL ? "העיבוד נכשל" : "Processing Failed"}</h3>
                    <p className="text-sm text-red-700">
                      {isRTL ? "ניתן לנסות שוב או לערוך את פרטי הפגישה" : "You can retry or edit meeting details"}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleRetryProcessing}
                  className="border-red-300 text-red-700 hover:bg-red-100 bg-transparent"
                >
                  <RefreshCw className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                  {isRTL ? "נסה שוב" : "Retry"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Content Grid */}
        <div className="flex-1 overflow-auto p-3 md:p-6">
          {selectedMeeting && !isProcessing && !isFailed && !isDraft ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
              {/* Summary Card */}
              <Card className="lg:col-span-2">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="secondary" className="bg-teal-50 text-teal-700 hover:bg-teal-50">
                      {isRTL ? "AI סיכום" : "AI Summary"}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{sampleSummary.summary}</p>
                </CardContent>
              </Card>

              {/* Decisions Card */}
              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 text-amber-700" />
                      </span>
                      {isRTL ? "החלטות" : "Decisions"}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setShowNewDecision(true)}
                      disabled={isProcessing || isFailed}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {decisions.map((decision, index) => (
                    <div key={decision.id} className="flex gap-2 p-2 bg-muted/50 rounded group text-sm mb-1">
                      <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center flex-shrink-0 text-xs font-medium">
                        {index + 1}
                      </span>
                      {editingDecisionId === decision.id ? (
                        <div className="flex-1 flex items-center gap-1">
                          <Input
                            value={editingDecisionText}
                            onChange={(e) => setEditingDecisionText(e.target.value)}
                            className="flex-1 text-sm h-7"
                            autoFocus
                          />
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleSaveDecision}>
                            <Check className="w-3 h-3 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setEditingDecisionId(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <p className="flex-1 text-foreground">{decision.text}</p>
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => handleEditDecision(decision)}
                            >
                              <Pencil className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 text-red-600"
                              onClick={() => handleDeleteDecision(decision.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {showNewDecision && (
                    <div className="flex gap-2 p-2 bg-muted/50 rounded">
                      <Input
                        value={newDecision}
                        onChange={(e) => setNewDecision(e.target.value)}
                        placeholder={isRTL ? "החלטה חדשה..." : "New decision..."}
                        className="flex-1 text-sm h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddDecision()
                          if (e.key === "Escape") setShowNewDecision(false)
                        }}
                      />
                      <Button size="sm" className="h-8" onClick={handleAddDecision}>
                        {isRTL ? "הוסף" : "Add"}
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tasks Card */}
              <Card>
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium text-sm flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                        <Calendar className="w-3.5 h-3.5 text-blue-700" />
                      </span>
                      {isRTL ? "משימות" : "Tasks"}
                    </h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => setShowNewTask(true)}
                      disabled={isProcessing || isFailed}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "p-2 rounded border transition-colors group mb-1",
                        completedTasks.has(task.id) ? "bg-muted/30 border-muted" : "bg-white border-border",
                      )}
                    >
                      {editingTaskId === task.id && editingTask ? (
                        <div className="space-y-2">
                          <Input
                            value={editingTask.task}
                            onChange={(e) => setEditingTask({ ...editingTask, task: e.target.value })}
                            className="text-sm h-8"
                          />
                          <div className="flex gap-2">
                            <Input
                              value={editingTask.assignee}
                              onChange={(e) => setEditingTask({ ...editingTask, assignee: e.target.value })}
                              placeholder={isRTL ? "אחראי" : "Assignee"}
                              className="text-sm flex-1 h-8"
                            />
                            <Input
                              type="date"
                              value={editingTask.dueDate}
                              onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                              className="text-sm w-32 h-8"
                              dir="ltr"
                            />
                          </div>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" className="h-7" onClick={handleSaveTask}>
                              {isRTL ? "שמור" : "Save"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingTaskId(null)}>
                              {isRTL ? "ביטול" : "Cancel"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={completedTasks.has(task.id)}
                            onCheckedChange={() => toggleTask(task.id)}
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className={cn(
                                "text-sm font-medium",
                                completedTasks.has(task.id) && "line-through text-muted-foreground",
                              )}
                            >
                              {task.task}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span>{task.assignee}</span>
                              <span dir="ltr">{task.dueDate}</span>
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
                        </div>
                      )}
                    </div>
                  ))}
                  {showNewTask && (
                    <div className="p-2 rounded border border-border space-y-2">
                      <Input
                        value={newTask.task}
                        onChange={(e) => setNewTask({ ...newTask, task: e.target.value })}
                        placeholder={isRTL ? "משימה חדשה" : "New task"}
                        className="text-sm h-8"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Input
                          value={newTask.assignee}
                          onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                          placeholder={isRTL ? "אחראי" : "Assignee"}
                          className="text-sm flex-1 h-8"
                        />
                        <Input
                          type="date"
                          value={newTask.dueDate}
                          onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                          className="text-sm w-32 h-8"
                          dir="ltr"
                        />
                      </div>
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" className="h-7" onClick={handleAddTask}>
                          {isRTL ? "הוסף" : "Add"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowNewTask(false)}>
                          {isRTL ? "ביטול" : "Cancel"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Speakers Card */}
              <Card className="lg:col-span-2">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center">
                      <Users className="w-3.5 h-3.5 text-purple-700" />
                    </span>
                    <h3 className="font-medium text-sm">{isRTL ? "דוברים" : "Speakers"}</h3>
                  </div>

                  {hasUnnamedSpeakers && (
                    <p className="text-xs text-rose-600 mb-3 mr-8">
                      {isRTL
                        ? "הקצאת שמות תאפשר חיפוש ותובנות מדויקות יותר"
                        : "Assigning names will enable more accurate search and insights"}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    {participants.map((participant) => (
                      <div key={participant.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg group">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                            {getInitials(participant.name)}
                          </AvatarFallback>
                        </Avatar>
                        {editingParticipantId === participant.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingParticipantName}
                              onChange={(e) => setEditingParticipantName(e.target.value)}
                              className="w-28 h-7 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveParticipant()
                                if (e.key === "Escape") setEditingParticipantId(null)
                              }}
                            />
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleSaveParticipant}>
                              <Check className="w-3 h-3 text-green-600" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <div>
                              <p className="text-sm font-medium">{participant.name}</p>
                              <p className="text-xs text-muted-foreground">{participant.role}</p>
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
                                <DropdownMenuItem onClick={() => handleEditParticipant(participant)}>
                                  <Pencil className="w-3 h-3 mr-2" />
                                  {isRTL ? "שנה שם" : "Rename"}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleOpenMerge(participant)}>
                                  <GitMerge className="w-3 h-3 mr-2" />
                                  {isRTL ? "מזג עם דובר אחר" : "Merge with another"}
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleDeleteParticipant(participant.id)}
                                  className="text-red-600"
                                >
                                  <Trash2 className="w-3 h-3 mr-2" />
                                  {isRTL ? "מחק" : "Delete"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <StatusEmptyState status={selectedMeeting?.status || "draft"} />
          )}
        </div>

        {/* Audio Player - Fixed bottom */}
        {selectedMeeting && selectedMeeting.status === "completed" && (
          <div className="border-t border-border bg-white p-2 md:p-4">
            <AudioPlayer />
          </div>
        )}
      </div>

      {/* Documents Panel - slides from right */}
      {showDocuments && (
        <div className="w-80 flex-shrink-0 border-s border-border bg-white hidden lg:block">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-medium">{isRTL ? "מסמכים קשורים" : "Related Documents"}</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowDocuments(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DocumentsPanel />
        </div>
      )}

      {/* Chat Panel - slides from right */}
      {showChat && (
        <div className="w-80 flex-shrink-0 border-s border-border bg-white hidden lg:block">
          <div className="flex items-center justify-between p-4 border-b border-border">
            <h3 className="font-medium">{isRTL ? "צ׳אט על הפגישה" : "Chat about meeting"}</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowChat(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <MeetingChat />
        </div>
      )}

      <div
        className={cn(
          "flex-shrink-0 border-s border-border bg-white transition-all duration-300",
          showTranscript ? "w-72 lg:w-80" : "w-10",
          "hidden md:block",
        )}
      >
        {showTranscript ? (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-medium text-sm">{isRTL ? "תמליל" : "Transcript"}</h3>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowTranscript(false)}>
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {isProcessing ? (
                <StatusEmptyState status="processing" section={isRTL ? "התמליל" : "Transcript"} />
              ) : (
                <TranscriptPanel
                  transcript={transcriptWithNames}
                  speakerNames={speakerNames}
                  onSpeakerNameChange={handleSpeakerNameChange}
                />
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowTranscript(true)}
            className="h-full w-full flex items-center justify-center hover:bg-muted/50 transition-colors"
            title={isRTL ? "הצג תמליל" : "Show Transcript"}
          >
            <span
              className="writing-mode-vertical text-xs text-muted-foreground font-medium"
              style={{ writingMode: "vertical-rl", transform: isRTL ? "rotate(180deg)" : "none" }}
            >
              {isRTL ? "תמליל" : "Transcript"}
            </span>
          </button>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "מחיקת פגישה" : "Delete Meeting"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `האם אתה בטוח שברצונך למחוק את הפגישה "${selectedMeeting?.title}"?`
                : `Are you sure you want to delete "${selectedMeeting?.title}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              {isRTL ? "ביטול" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDeleteMeeting}>
              {isRTL ? "מחק" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRTL ? "מיזוג דוברים" : "Merge Speakers"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `בחר את הדובר שאליו תרצה למזג את "${mergeSource?.name}"`
                : `Select which speaker to merge "${mergeSource?.name}" into`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4">
            {participants
              .filter((p) => p.id !== mergeSource?.id)
              .map((p) => (
                <label
                  key={p.id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    mergeTarget === p.id ? "border-teal-500 bg-teal-50" : "border-border hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="mergeTarget"
                    value={p.id}
                    checked={mergeTarget === p.id}
                    onChange={() => setMergeTarget(p.id)}
                    className="sr-only"
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                      {getInitials(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{p.name}</span>
                </label>
              ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowMergeDialog(false)}>
              {isRTL ? "ביטול" : "Cancel"}
            </Button>
            <Button onClick={handleMergeParticipants} disabled={!mergeTarget}>
              {isRTL ? "מזג" : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
