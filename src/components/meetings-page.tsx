"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import dynamic from "next/dynamic"
import {
  AlertCircle,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileAudio,
  FileText,
  GitMerge,
  Info,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { MeetingsSidebar } from "@/components/meetings/meetings-sidebar"
import { ProcessingStepper, type ProcessingStepKey, type ProcessingStepStatus } from "@/components/processing-stepper"

// Lazy-load heavy components for better initial page load
const TranscriptPanel = dynamic(() => import("@/components/meetings/transcript-panel").then(mod => ({ default: mod.TranscriptPanel })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
})
const MeetingChat = dynamic(() => import("@/components/meetings/meeting-chat").then(mod => ({ default: mod.MeetingChat })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
})
const DocumentsPanel = dynamic(() => import("@/components/meetings/documents-panel").then(mod => ({ default: mod.DocumentsPanel })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div>
})
const AudioPlayer = dynamic(() => import("@/components/meetings/audio-player").then(mod => ({ default: mod.AudioPlayer })), {
  ssr: false,
  loading: () => <div className="h-24 flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin" /></div>
})
import { StatusEmptyState } from "@/components/status-empty-state"
import { MeetingSkeleton } from "@/components/meetings/meeting-skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { useToast } from "@/hooks/use-toast"
import { updateSession, deleteSession, startTranscription } from "@/hooks/use-session"
import { useActionItemsQuery, useCompletionNotification, useEnhancementTrigger, useInvalidateSessions, useRealtimeSessionStatus, useSessionQuery, useSessionRecovery, useSessionTranscriptQuery, useSessionsQuery, useSpeakersQuery, useTranscriptionStatusPolling } from "@/hooks/use-session-query"
import { cn } from "@/lib/utils"
import { getSpeakerColor } from "@/lib/speaker-colors"
import type { Session, SessionWithRelations, TranscriptSegment } from "@/lib/types/database"

interface MeetingsPageProps {
  initialMeetingId?: string | null
}

interface MeetingListItem {
  id: string
  title: string
  date: string
  time: string
  duration: string
  participants: string[]
  status: "completed" | "processing" | "pending" | "draft" | "failed" | "enhancing"
  currentStep?: ProcessingStepKey
  context?: string
  source?: string
  audioUrl?: string | null
}

interface Speaker {
  speakerId: string
  speakerName: string
  segmentCount: number
}

function formatDate(dateString: string, locale: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })
}

function formatTime(dateString: string, locale: string) {
  const date = new Date(dateString)
  return date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
}

// Hook to ensure dates are only formatted on the client (avoiding SSR timezone mismatch)
function useClientTime() {
  const [isClient, setIsClient] = useState(false)
  useEffect(() => {
    setIsClient(true)
  }, [])
  return isClient
}

function formatDuration(seconds: number | null) {
  if (!seconds) return "--:--"
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.floor(seconds % 60)
  return `${minutes}:${remaining.toString().padStart(2, "0")}`
}

function mapStatus(session: Session): "completed" | "processing" | "draft" | "failed" | "enhancing" {
  if (session.processing_state === "draft") return "draft"
  if (session.processing_state === "failed" || session.status === "failed") return "failed"
  // Show enhancing state for pending_enhancements or enhancing
  if (session.processing_state === "pending_enhancements" || session.processing_state === "enhancing") return "enhancing"
  if (session.processing_state === "processing" || session.status === "processing" || session.status === "pending") return "processing"
  return "completed"
}

function getCurrentStep(session: Session): ProcessingStepKey | undefined {
  if (session.current_step) return session.current_step as ProcessingStepKey
  const active = session.processing_steps?.find((step) => step.status === "active")
  return active?.step as ProcessingStepKey | undefined
}

function getSourceLabel(session: Session, isRTL: boolean) {
  const metadata = session.source_metadata || {}
  const isCalendar = typeof metadata === "object" && "provider" in metadata
  const isTranscript = !session.audio_url && session.transcription_job_id === null
  if (isCalendar) {
    return isRTL ? "מקור: יומן שהובא" : "Source: imported from calendar"
  }
  if (isTranscript) {
    return isRTL ? "מקור: תמליל שהועלה ידנית" : "Source: manually uploaded transcript"
  }
  return isRTL ? "מקור: קובץ שמע" : "Source: audio upload"
}

type EmptyStateSection = "summary" | "decisions" | "tasks" | "transcript" | "documents" | "chat"

function getSectionStatus(session: Session | MeetingListItem | null | undefined, hasContent: boolean, sectionType?: EmptyStateSection) {
  if (!session) return "empty"
  const status = (session as MeetingListItem).status
  const processingState = (session as Session).processing_state

  // Transcription in progress
  if (processingState === "processing" || status === "processing" || status === "pending") {
    return "processing"
  }
  // Enhancement in progress (summary, entities, embeddings)
  // PROGRESSIVE DISCLOSURE: Transcript should show content during enhancement if available
  if (processingState === "pending_enhancements" || processingState === "enhancing" || status === "enhancing") {
    // If this is the transcript section and we have content, show it instead of spinner
    if (sectionType === "transcript" && hasContent) {
      return "partial_ready" // New status - transcript ready, enhancements in progress
    }
    return "enhancing"
  }
  if (processingState === "draft" || status === "draft") return "draft"
  if (processingState === "failed" || status === "failed") return "failed"

  // Return section-specific empty states
  if (!hasContent && sectionType) {
    switch (sectionType) {
      case "summary": return "empty_summary"
      case "decisions": return "empty_decisions"
      case "tasks": return "empty_tasks"
      case "transcript": return "empty_transcript"
      default: return "empty"
    }
  }
  return "empty"
}

export function MeetingsPage({ initialMeetingId }: MeetingsPageProps) {
  const { isRTL } = useLanguage()
  const locale = isRTL ? "he-IL" : "en-US"
  const router = useRouter()
  const { toast } = useToast()
  const isClient = useClientTime() // Ensure time is formatted in user's local timezone

  const { data: sessions = [], isLoading: isLoadingSessions } = useSessionsQuery(50)

  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(initialMeetingId || null)
  const [showChat, setShowChat] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  const [showMobileSidebar, setShowMobileSidebar] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState("")
  const [highlightedSegmentId, setHighlightedSegmentId] = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState(true)
  const [showMobileTranscript, setShowMobileTranscript] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [mergeSource, setMergeSource] = useState<Speaker | null>(null)
  const [mergeTarget, setMergeTarget] = useState<string>("")

  // Decisions inline editing state
  const [editingDecisionId, setEditingDecisionId] = useState<string | null>(null)
  const [editingDecisionText, setEditingDecisionText] = useState("")
  const [showNewDecision, setShowNewDecision] = useState(false)
  const [newDecisionText, setNewDecisionText] = useState("")
  const [localDecisions, setLocalDecisions] = useState<Array<{ id: string; description: string }>>([])

  // Tasks inline editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<{ description: string; assignee: string; deadline: string } | null>(null)
  const [showNewTask, setShowNewTask] = useState(false)
  const [newTask, setNewTask] = useState({ description: "", assignee: "", deadline: "" })
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set())

  // Speaker editing state
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null)
  const [editingSpeakerName, setEditingSpeakerName] = useState("")

  // Summary editing state
  const [editingSummary, setEditingSummary] = useState(false)
  const [editedOverviewText, setEditedOverviewText] = useState("")
  const [savingSummary, setSavingSummary] = useState(false)

  // Loading states
  const [savingDecision, setSavingDecision] = useState(false)
  const [savingTask, setSavingTask] = useState(false)
  const [togglingTaskId, setTogglingTaskId] = useState<string | null>(null)
  const [mergingSpeakers, setMergingSpeakers] = useState(false)
  const [deletingMeeting, setDeletingMeeting] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  // Delete confirmation states
  const [showDeleteDecisionDialog, setShowDeleteDecisionDialog] = useState(false)
  const [showDeleteTaskDialog, setShowDeleteTaskDialog] = useState(false)
  const [pendingDeleteDecisionIndex, setPendingDeleteDecisionIndex] = useState<number | null>(null)
  const [pendingDeleteTaskId, setPendingDeleteTaskId] = useState<string | null>(null)

  // Ref to prevent auto-selection race condition during delete
  const isDeletingRef = useRef(false)

  const searchParams = useSearchParams()

  const { data: sessionData, isPending: isLoadingSessionDetail, isFetching: isRefetchingSession } = useSessionQuery(selectedMeetingId, false)
  const { data: transcriptData } = useSessionTranscriptQuery(selectedMeetingId)

  // Merge session data with transcript
  const session = useMemo(() => {
    if (!sessionData) return null
    return {
      ...sessionData,
      transcript: transcriptData ? transcriptData : undefined
    } as SessionWithRelations
  }, [sessionData, transcriptData])

  // Poll for transcription status updates when session is processing (fallback)
  useTranscriptionStatusPolling(session)
  // Subscribe to realtime status updates for instant updates (preferred)
  useRealtimeSessionStatus(selectedMeetingId)
  // Auto-trigger enhancement pipeline when transcription completes
  const { isEnhancing, enhancementError, retryEnhancement } = useEnhancementTrigger(session)
  // Show toast notification when processing completes
  useCompletionNotification(session, () => {
    toast({
      title: isRTL ? "הפגישה מוכנה" : "Meeting Ready",
      description: isRTL ? "התמליל, הסיכום והתובנות מוכנים לצפייה" : "Transcript, summary and insights are ready to view",
    })
  })
  // Auto-recover stuck sessions (content exists but state is wrong)
  const { isRecovering, wasRecovered, triggerRecovery } = useSessionRecovery(session)
  const { data: speakersData = [] } = useSpeakersQuery(selectedMeetingId)
  const speakers = speakersData as Speaker[]
  const { data: actionItemsData } = useActionItemsQuery(selectedMeetingId)
  const actionItems = actionItemsData ?? []
  const { invalidateSession, invalidateSessionsList, removeSessionFromList, removeSessionFromDetailCache } = useInvalidateSessions()
  const [nameSuggestions, setNameSuggestions] = useState<string[]>([])

  useEffect(() => {
    // Don't clear selection while still loading session data
    if (isLoadingSessionDetail || isRefetchingSession) return
    if (!selectedMeetingId || session !== null) return
    // Deleted/not found meeting: clear selection and leave detail route.
    isDeletingRef.current = true
    setSelectedMeetingId(null)
    router.replace("/meetings")
  }, [session, selectedMeetingId, router, isLoadingSessionDetail, isRefetchingSession])

  useEffect(() => {
    // Skip auto-selection during delete to prevent race condition
    if (isDeletingRef.current) return
    if (!selectedMeetingId && sessions.length > 0) {
      setSelectedMeetingId(sessions[0].id)
    }
  }, [sessions, selectedMeetingId])

  useEffect(() => {
    const segment = searchParams.get("seg")
    const timeParam = searchParams.get("t")
    const docParam = searchParams.get("doc")
    const chunkParam = searchParams.get("chunkId")

    if (segment) {
      setHighlightedSegmentId(segment)
    }

    if (docParam || chunkParam) {
      setShowDocuments(true)
    }

    if (timeParam) {
      const time = Number.parseFloat(timeParam)
      if (!Number.isNaN(time)) {
        const attemptSeek = () => {
          const seek = (window as unknown as { meetingAudioSeekTo?: (value: number) => void }).meetingAudioSeekTo
          if (seek) {
            seek(time)
            return true
          }
          return false
        }

        if (!attemptSeek()) {
          setTimeout(attemptSeek, 500)
        }
      }
    }
  }, [searchParams])

  useEffect(() => {
    const loadPeople = async () => {
      try {
        const response = await fetch("/api/people")
        if (!response.ok) return
        const data = await response.json()
        const names = (data.people || [])
          .map((person: { display_name: string }) => person.display_name)
          .filter(Boolean)
        setNameSuggestions(names)
      } catch {
        // Silently fail - people/autocomplete is an optional feature
        // This may fail if the people table doesn't exist in the database
      }
    }
    loadPeople()
  }, [])

  const meetingsList: MeetingListItem[] = useMemo(() => {
    return sessions.map((item) => {
      const status = mapStatus(item)
      const metadata = item.source_metadata as { attendees?: Array<{ name?: string; email?: string }> } | null
      const participants = metadata?.attendees
        ? metadata.attendees.map((attendee) => attendee.name || attendee.email).filter((p): p is string => !!p)
        : []
      return {
        id: item.id,
        title: item.title || (isRTL ? "פגישה ללא שם" : "Untitled meeting"),
        date: isClient ? formatDate(item.created_at, locale) : "",
        time: isClient ? formatTime(item.created_at, locale) : "",
        duration: formatDuration(item.duration_seconds),
        participants,
        status,
        currentStep: getCurrentStep(item),
        context: item.context || undefined,
        audioUrl: item.audio_url,
      }
    })
  }, [sessions, isRTL, locale, isClient])

  const transcriptItems = useMemo(() => {
    // Filter out deleted segments (secondary safeguard - API should already filter)
    const segments: TranscriptSegment[] = (session?.transcript?.segments || []).filter(
      (s) => !s.is_deleted
    )
    if (segments.length === 0) return []

    // Merge consecutive segments from the same speaker for better readability
    const merged: {
      id: string
      speakerId: string
      speaker: string
      time: string
      text: string
    }[] = []

    for (const segment of segments) {
      const lastMerged = merged[merged.length - 1]
      const speakerName = segment.speaker_display_name || segment.speaker_name || segment.speaker_id

      if (lastMerged && lastMerged.speakerId === segment.speaker_id) {
        // Same speaker - merge the text
        merged[merged.length - 1] = {
          ...lastMerged,
          text: lastMerged.text + " " + segment.text,
        }
      } else {
        // Different speaker - add new entry
        merged.push({
          id: segment.id,
          speakerId: segment.speaker_id,
          speaker: speakerName,
          time: formatDuration(segment.start_time),
          text: segment.text,
        })
      }
    }

    return merged
  }, [session])

  const hasTranscript = session?.transcript?.segments && session.transcript.segments.length > 0

  const speakerNames = useMemo(() => {
    const map = new Map<string, string>()
    speakers.forEach((speaker) => {
      if (!map.has(speaker.speakerId)) {
        map.set(speaker.speakerId, speaker.speakerName)
      }
    })
    return map
  }, [speakers])

  const unnamedSpeakers = speakers.filter((speaker) => {
    const name = speaker.speakerName?.toLowerCase() || ""
    return !name || name.startsWith("speaker") || name.startsWith("דובר") || name === speaker.speakerId
  })

  // Sync local decisions with session
  useEffect(() => {
    const sessionDecisions = session?.summary?.decisions || session?.summary?.key_points || []
    const nextDecisions = sessionDecisions.map((d: string | { id?: string; description: string }, index: number) =>
      typeof d === "string"
        ? { id: `legacy-${index}`, description: d }
        : { id: d.id || `legacy-${index}`, description: d.description }
    )
    setLocalDecisions((prev) => {
      if (prev.length === nextDecisions.length && prev.every((item, idx) =>
        item.id === nextDecisions[idx].id && item.description === nextDecisions[idx].description
      )) {
        return prev
      }
      return nextDecisions
    })
  }, [session?.summary?.decisions, session?.summary?.key_points])

  // Sync completed tasks from actionItems
  useEffect(() => {
    if (!actionItemsData) {
      setCompletedTasks((prev) => (prev.size === 0 ? prev : new Set()))
      return
    }
    const completed = new Set<string>()
    actionItemsData.forEach((item) => {
      if (item.completed) {
        completed.add(item.id)
      }
    })
    setCompletedTasks((prev) => {
      if (prev.size === completed.size && [...prev].every((id) => completed.has(id))) {
        return prev
      }
      return completed
    })
  }, [actionItemsData])

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
  }

  const toggleTask = async (id: string) => {
    if (!session || togglingTaskId === id) return
    const isCompleted = completedTasks.has(id)

    setTogglingTaskId(id)
    // Optimistic update
    setCompletedTasks((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })

    try {
      const response = await fetch(`/api/sessions/${session.id}/action-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !isCompleted }),
      })
      if (!response.ok) throw new Error("Failed to update task")
      invalidateSession(session.id)
    } catch (error) {
      // Revert on error
      setCompletedTasks((prev) => {
        const next = new Set(prev)
        if (isCompleted) {
          next.add(id)
        } else {
          next.delete(id)
        }
        return next
      })
      toast({
        title: isRTL ? "שגיאה בעדכון משימה" : "Error updating task",
        variant: "destructive",
      })
    } finally {
      setTogglingTaskId(null)
    }
  }

  // Decision handlers
  const handleAddDecision = async () => {
    if (!newDecisionText.trim() || !session) return
    setSavingDecision(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newDecisionText.trim() }),
      })
      if (!response.ok) throw new Error("Failed to add decision")
      const data = await response.json()
      setLocalDecisions([...localDecisions, { id: data.decision.id, description: data.decision.description }])
      setNewDecisionText("")
      setShowNewDecision(false)
      toast({ title: isRTL ? "החלטה נוספה" : "Decision added" })
      invalidateSession(session.id)
    } catch (error) {
      console.error("Failed to add decision:", error)
      toast({
        title: isRTL ? "שגיאה בהוספת החלטה" : "Error adding decision",
        variant: "destructive",
      })
    } finally {
      setSavingDecision(false)
    }
  }

  const handleEditDecision = (decision: { id: string; description: string }) => {
    setEditingDecisionId(decision.id)
    setEditingDecisionText(decision.description)
  }

  const handleSaveDecision = async () => {
    if (!editingDecisionText.trim() || !editingDecisionId || !session) return
    setSavingDecision(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/decisions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisionId: editingDecisionId, description: editingDecisionText.trim() }),
      })
      if (!response.ok) throw new Error("Failed to update decision")
      setLocalDecisions(
        localDecisions.map((d) =>
          d.id === editingDecisionId ? { ...d, description: editingDecisionText.trim() } : d
        )
      )
      setEditingDecisionId(null)
      setEditingDecisionText("")
      toast({ title: isRTL ? "החלטה עודכנה" : "Decision updated" })
      invalidateSession(session.id)
    } catch (error) {
      console.error("Failed to update decision:", error)
      toast({
        title: isRTL ? "שגיאה בעדכון החלטה" : "Error updating decision",
        variant: "destructive",
      })
    } finally {
      setSavingDecision(false)
    }
  }

  const handleSaveSummary = async () => {
    if (!editedOverviewText.trim() || !session) return
    setSavingSummary(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/summarize`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overview: editedOverviewText.trim() }),
      })
      if (!response.ok) {
        if (response.status === 401) throw new Error(isRTL ? "יש להתחבר מחדש" : "Please sign in again")
        if (response.status === 404) throw new Error(isRTL ? "הסיכום לא נמצא" : "Summary not found")
        throw new Error(isRTL ? "שגיאה בעדכון הסיכום" : "Failed to update summary")
      }
      setEditingSummary(false)
      toast({ title: isRTL ? "סיכום עודכן" : "Summary updated" })
      invalidateSession(session.id)
    } catch (error) {
      console.error("Failed to update summary:", error)
      toast({
        title: error instanceof Error ? error.message : (isRTL ? "שגיאה בעדכון הסיכום" : "Error updating summary"),
        variant: "destructive",
      })
    } finally {
      setSavingSummary(false)
    }
  }

  const handleDeleteDecision = (decisionId: string) => {
    setPendingDeleteDecisionIndex(localDecisions.findIndex((d) => d.id === decisionId))
    setShowDeleteDecisionDialog(true)
  }

  const handleConfirmDeleteDecision = async () => {
    if (pendingDeleteDecisionIndex === null || !session) return
    const decision = localDecisions[pendingDeleteDecisionIndex]
    setSavingDecision(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/decisions?decisionId=${decision.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete decision")
      setLocalDecisions(localDecisions.filter((d) => d.id !== decision.id))
      toast({ title: isRTL ? "החלטה נמחקה" : "Decision deleted" })
      invalidateSession(session.id)
    } catch (error) {
      console.error("Failed to delete decision:", error)
      toast({
        title: isRTL ? "שגיאה במחיקת החלטה" : "Error deleting decision",
        variant: "destructive",
      })
    } finally {
      setSavingDecision(false)
      setShowDeleteDecisionDialog(false)
      setPendingDeleteDecisionIndex(null)
    }
  }

  // Task handlers
  const handleAddTask = async () => {
    if (!newTask.description.trim() || !session) return
    setSavingTask(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: newTask.description.trim(),
          assignee: newTask.assignee || null,
          deadline: newTask.deadline || null,
        }),
      })
      if (!response.ok) throw new Error("Failed to add task")
      toast({ title: isRTL ? "משימה נוספה" : "Task added" })
      setNewTask({ description: "", assignee: "", deadline: "" })
      setShowNewTask(false)
      invalidateSession(session.id)
    } catch (error) {
      console.error("Failed to add task:", error)
      toast({
        title: isRTL ? "שגיאה בהוספת משימה" : "Error adding task",
        variant: "destructive",
      })
    } finally {
      setSavingTask(false)
    }
  }

  const handleEditTask = (task: typeof actionItems[0]) => {
    setEditingTaskId(task.id)
    setEditingTask({
      description: task.description,
      assignee: task.assignee || "",
      deadline: task.deadline || "",
    })
  }

  const handleSaveTask = async () => {
    if (!editingTask || !editingTask.description.trim() || !editingTaskId || !session) return
    setSavingTask(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/action-items/${editingTaskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: editingTask.description.trim(),
          assignee: editingTask.assignee || null,
          deadline: editingTask.deadline || null,
        }),
      })
      if (!response.ok) throw new Error("Failed to update task")
      toast({ title: isRTL ? "משימה עודכנה" : "Task updated" })
      setEditingTaskId(null)
      setEditingTask(null)
      invalidateSession(session.id)
    } catch (error) {
      console.error("Failed to update task:", error)
      toast({
        title: isRTL ? "שגיאה בעדכון משימה" : "Error updating task",
        variant: "destructive",
      })
    } finally {
      setSavingTask(false)
    }
  }

  const handleDeleteTask = (id: string) => {
    setPendingDeleteTaskId(id)
    setShowDeleteTaskDialog(true)
  }

  const handleConfirmDeleteTask = async () => {
    if (!pendingDeleteTaskId || !session) return
    setSavingTask(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/action-items/${pendingDeleteTaskId}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete task")
      toast({ title: isRTL ? "משימה נמחקה" : "Task deleted" })
      invalidateSession(session.id)
    } catch (error) {
      console.error("Failed to delete task:", error)
      toast({
        title: isRTL ? "שגיאה במחיקת משימה" : "Error deleting task",
        variant: "destructive",
      })
    } finally {
      setSavingTask(false)
      setShowDeleteTaskDialog(false)
      setPendingDeleteTaskId(null)
    }
  }

  // Speaker handlers
  const handleEditSpeaker = (speaker: Speaker) => {
    setEditingSpeakerId(speaker.speakerId)
    setEditingSpeakerName(speaker.speakerName)
  }

  const handleSaveSpeaker = () => {
    if (editingSpeakerId && editingSpeakerName.trim()) {
      handleSpeakerNameChange(editingSpeakerId, editingSpeakerName.trim())
      setEditingSpeakerId(null)
      setEditingSpeakerName("")
    }
  }

  const handleOpenMerge = (speaker: Speaker) => {
    setMergeSource(speaker)
    setMergeTarget("")
    setShowMergeDialog(true)
  }

  const handleMergeParticipants = async () => {
    if (!mergeSource || !mergeTarget || !session) return
    const targetSpeaker = speakers.find((s) => s.speakerId === mergeTarget)
    setMergingSpeakers(true)
    try {
      const response = await fetch(`/api/sessions/${session.id}/speakers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceSpeakerId: mergeSource.speakerId,
          targetSpeakerId: mergeTarget,
          targetSpeakerName: targetSpeaker?.speakerName,
        }),
      })
      if (!response.ok) throw new Error("Failed to merge speakers")
      toast({ title: isRTL ? "דוברים מוזגו" : "Speakers merged" })
      setShowMergeDialog(false)
      setMergeSource(null)
      setMergeTarget("")
      invalidateSession(session.id)
    } catch (error) {
      console.error("Failed to merge speakers:", error)
      toast({
        title: isRTL ? "שגיאה במיזוג דוברים" : "Error merging speakers",
        variant: "destructive",
      })
    } finally {
      setMergingSpeakers(false)
    }
  }

  const handleConfirmDelete = async () => {
    setDeletingMeeting(true)
    await handleDeleteMeeting()
    setDeletingMeeting(false)
    setShowDeleteDialog(false)
  }

  const handleSelectMeeting = (id: string) => {
    setSelectedMeetingId(id)
    router.push(`/meetings/${id}`)
  }

  const handleStartEditTitle = () => {
    if (!session) return
    setTitleValue(session.title || "")
    setEditingTitle(true)
  }

  const handleSaveTitle = async () => {
    if (!session || !titleValue.trim()) {
      setEditingTitle(false)
      return
    }
    try {
      await updateSession(session.id, { title: titleValue.trim() })
      invalidateSession(session.id)
      invalidateSessionsList()
      setEditingTitle(false)
    } catch (error) {
      console.error("Failed to save title:", error)
      toast({
        title: isRTL ? "שגיאה בשמירת השם" : "Error saving title",
        description: isRTL ? "נסה שוב מאוחר יותר" : "Please try again later",
        variant: "destructive",
      })
    }
  }

  const handleDeleteMeeting = async () => {
    if (!session) return
    const sessionId = session.id
    // Block auto-selection during delete to prevent race condition
    isDeletingRef.current = true
    try {
      await deleteSession(sessionId)
      // Remove from all caches BEFORE changing selectedMeetingId to prevent 404 error
      removeSessionFromDetailCache(sessionId)
      removeSessionFromList(sessionId)
      setSelectedMeetingId(null)
      invalidateSessionsList()
      // Navigate to /meetings to ensure clean state
      router.push("/meetings")
      toast({
        title: isRTL ? "הפגישה נמחקה" : "Meeting deleted",
      })
    } catch (error) {
      console.error("Failed to delete meeting:", error)
      toast({
        title: isRTL ? "שגיאה במחיקה" : "Error deleting meeting",
        description: isRTL ? "נסה שוב מאוחר יותר" : "Please try again later",
        variant: "destructive",
      })
    } finally {
      // Reset after delay to allow navigation to complete
      setTimeout(() => { isDeletingRef.current = false }, 1000)
    }
  }

  const handleRetryProcessing = async () => {
    // Use selectedMeeting as fallback when session detail hasn't loaded yet
    const audioUrl = session?.audio_url ?? selectedMeeting?.audioUrl
    const sessionId = session?.id ?? selectedMeetingId

    if (!audioUrl || !sessionId || isRetrying) return

    setIsRetrying(true)
    try {
      // Try the recovery endpoint - it checks if content exists and fixes the state
      // IMPORTANT: This should NEVER delete content, only fix state
      const recoveryResponse = await fetch(`/api/sessions/${sessionId}/recover`, {
        method: "POST",
      })

      const recoveryData = await recoveryResponse.json()
      console.log("[handleRetryProcessing] Recovery response:", recoveryData)

      if (recoveryResponse.ok && recoveryData.recovered) {
        // Recovery successful - state was fixed
        if (recoveryData.status === "completed") {
          toast({
            title: isRTL ? "הפגישה שוחזרה" : "Meeting recovered",
            description: isRTL ? "הפגישה מוכנה לצפייה" : "The meeting is ready to view",
          })
        } else if (recoveryData.needsEnhancement) {
          toast({
            title: isRTL ? "ממשיך עיבוד" : "Continuing processing",
            description: isRTL ? "יוצר סיכום..." : "Generating summary...",
          })
        } else {
          toast({
            title: isRTL ? "הסטטוס עודכן" : "Status updated",
            description: isRTL ? "הפגישה מעובדת" : "Meeting is being processed",
          })
        }
      } else if (recoveryData.status === "processing") {
        // Transcription is still in progress
        toast({
          title: isRTL ? "העיבוד פועל" : "Processing active",
          description: isRTL ? "התמלול עדיין רץ, אנא המתן" : "Transcription is still running, please wait",
        })
      } else if (!recoveryResponse.ok) {
        throw new Error(recoveryData.error || "Recovery check failed")
      } else {
        // Recovery didn't change anything - just refresh
        toast({
          title: isRTL ? "מרענן" : "Refreshing",
          description: isRTL ? "טוען נתונים מעודכנים..." : "Loading updated data...",
        })
      }
    } catch (error) {
      console.error("Retry processing failed:", error)
      toast({
        title: isRTL ? "שגיאה" : "Error",
        description: isRTL ? "לא הצלחנו לבדוק את הסטטוס" : "Failed to check status",
        variant: "destructive",
      })
    } finally {
      setIsRetrying(false)
    }

    invalidateSession(sessionId)
    invalidateSessionsList()
  }

  // Separate handler for explicitly starting fresh transcription (user explicitly requests reprocess)
  const handleStartTranscription = async () => {
    const audioUrl = session?.audio_url ?? selectedMeeting?.audioUrl
    const sessionId = session?.id ?? selectedMeetingId

    if (!audioUrl || !sessionId || isRetrying) return

    setIsRetrying(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: ["transcription"] }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to start transcription")
      }

      toast({
        title: isRTL ? "התמלול התחיל" : "Transcription started",
        description: isRTL ? "הפגישה מעובדת כעת" : "Meeting is now being processed",
      })
    } catch (error) {
      console.error("Start transcription failed:", error)
      toast({
        title: isRTL ? "שגיאה" : "Error",
        description: isRTL ? "לא הצלחנו להתחיל את התמלול" : "Failed to start transcription",
        variant: "destructive",
      })
    } finally {
      setIsRetrying(false)
    }

    invalidateSession(sessionId)
    invalidateSessionsList()
  }

  // Helper to detect stuck sessions (processing for more than 10 minutes)
  const isStuckSession = (s: Session | null | undefined): boolean => {
    if (!s) return false
    // Check both processing and enhancing states
    if (s.processing_state !== "processing" && s.processing_state !== "enhancing") return false

    // Use processing steps' startedAt timestamps instead of updated_at
    // This ensures we only show "stuck" after processing has actually been running
    const steps = s.processing_steps as Array<{ startedAt?: string | null }> | undefined
    if (!steps || steps.length === 0) return false

    const startedSteps = steps.filter(step => step.startedAt)
    if (startedSteps.length === 0) return false  // Processing hasn't really started yet

    // Get the earliest startedAt timestamp
    const earliestStart = startedSteps
      .map(step => new Date(step.startedAt!).getTime())
      .filter(t => !Number.isNaN(t))
      .sort((a, b) => a - b)[0]

    if (!earliestStart) return false

    const stuckThreshold = 10 * 60 * 1000 // 10 minutes
    return Date.now() - earliestStart > stuckThreshold
  }

  const isStuck = isStuckSession(session)

  const handleSpeakerNameChange = async (speakerId: string, newName: string) => {
    if (!session) return
    try {
      const patchRes = await fetch(`/api/sessions/${session.id}/speakers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speakerId, speakerName: newName }),
      })
      if (!patchRes.ok) throw new Error("Failed to update speaker name")

      const assignRes = await fetch(`/api/sessions/${session.id}/speakers/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speakerId, personName: newName }),
      })
      if (!assignRes.ok) throw new Error("Failed to assign speaker")

      invalidateSession(session.id)
      toast({
        title: isRTL ? "שם דובר עודכן" : "Speaker named",
        description: isRTL ? "חיפוש לפי הדובר זמין כעת" : "Search by this speaker is now available",
      })
    } catch (error) {
      console.error("Failed to update speaker name:", error)
      toast({
        title: isRTL ? "שגיאה בעדכון שם" : "Error updating name",
        description: isRTL ? "נסה שוב מאוחר יותר" : "Please try again later",
        variant: "destructive",
      })
    }
  }

  const selectedMeeting = meetingsList.find((meeting) => meeting.id === selectedMeetingId)

  // A session is truly a draft only if both processing_state and status indicate no processing
  // If status is "processing" or "pending", the transcription has started even if processing_state is outdated
  const isDraft = (session?.processing_state === "draft" || (!session && selectedMeeting?.status === "draft")) &&
    session?.status !== "processing" &&
    session?.status !== "completed"

  const isPendingWithAudio = 
    (session?.status === "pending" || (!session && selectedMeeting?.status === "pending")) && 
    (session?.audio_url || selectedMeeting?.audioUrl) && 
    !hasTranscript

  // Transcription is in progress (audio being processed)
  const isTranscribing =
    (session &&
      (session.processing_state === "processing" || session.status === "processing" || session.status === "pending") &&
      !hasTranscript) ||
      (!session && (selectedMeeting?.status === "processing" || selectedMeeting?.status === "pending"))

  // Enhancement is in progress (summary, entities, embeddings being generated)
  // This happens AFTER transcription completes
  const isEnhancingState =
    (session && (session.processing_state === "pending_enhancements" || session.processing_state === "enhancing")) ||
    isEnhancing ||
    (!session && selectedMeeting?.status === "enhancing")

  // Combined processing state (either transcribing or enhancing)
  const isProcessing = isTranscribing || isEnhancingState

  const isFailed = (session && (session.processing_state === "failed" || session.status === "failed")) ||
    (!session && selectedMeeting?.status === "failed")

  const summaryText = session?.summary?.overview
  const decisions = session?.summary?.decisions || session?.summary?.key_points || []
  const attendeeSuggestions = useMemo(() => {
    const metadata = session?.source_metadata
    if (!metadata || typeof metadata !== "object") return [] as string[]
    const attendees = (metadata as { attendees?: Array<{ name?: string; email?: string }> }).attendees || []
    return attendees.map((attendee) => attendee.name || attendee.email).filter(Boolean) as string[]
  }, [session?.source_metadata])

  const mergedSuggestions = useMemo(() => {
    const merged = new Set<string>()
    nameSuggestions.forEach((name) => merged.add(name))
    attendeeSuggestions.forEach((name) => merged.add(name))
    return Array.from(merged)
  }, [nameSuggestions, attendeeSuggestions])

  return (
    <div className="flex h-[calc(100vh-3.5rem)]" dir={isRTL ? "rtl" : "ltr"}>
      {/* Mobile Transcript Sheet */}
      <Sheet open={showMobileTranscript} onOpenChange={setShowMobileTranscript}>
        <SheetContent side={isRTL ? "left" : "right"} className="w-80 p-0">
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-medium text-sm">{isRTL ? "תמליל" : "Transcript"}</h3>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowMobileTranscript(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {isPendingWithAudio ? (
                <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                  <FileAudio className="w-12 h-12 text-blue-500 mb-4" />
                  <h3 className="text-lg font-medium mb-2">
                    {isRTL ? "ממתין לעיבוד" : "Waiting for processing"}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    {isRTL ? "הקובץ מוכן. לחץ להתחיל תמלול." : "Audio file ready. Click to start transcription."}
                  </p>
                  <Button
                    onClick={handleStartTranscription}
                    disabled={!(session?.audio_url ?? selectedMeeting?.audioUrl) || isRetrying}
                    className="gap-2"
                  >
                    {isRetrying ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isRTL ? "מתחיל..." : "Starting..."}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        {isRTL ? "התחל תמלול" : "Start Transcription"}
                      </>
                    )}
                  </Button>
                </div>
              ) : isTranscribing ? (
                <StatusEmptyState status="processing" section={isRTL ? "התמליל" : "Transcript"} />
              ) : transcriptItems.length > 0 ? (
                <TranscriptPanel
                  transcript={transcriptItems}
                  speakerNames={Object.fromEntries(speakerNames)}
                  onSpeakerNameChange={handleSpeakerNameChange}
                  nameSuggestions={mergedSuggestions}
                  highlightedSegmentId={highlightedSegmentId}
                />
              ) : (
                <StatusEmptyState status="empty_transcript" />
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Mobile Meetings Sidebar Sheet */}
      <Sheet open={showMobileSidebar} onOpenChange={setShowMobileSidebar}>
        <SheetContent side={isRTL ? "right" : "left"} className="w-80 p-0">
          <MeetingsSidebar
            meetings={meetingsList}
            selectedId={selectedMeetingId || ""}
            onSelect={(id) => {
              handleSelectMeeting(id)
              setShowMobileSidebar(false)
            }}
            onRetry={handleRetryProcessing}
          />
        </SheetContent>
      </Sheet>

      <div className="hidden md:block w-80 flex-shrink-0 border-e border-border">
        <MeetingsSidebar
          meetings={meetingsList}
          selectedId={selectedMeetingId || ""}
          onSelect={handleSelectMeeting}
          onRetry={handleRetryProcessing}
        />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {selectedMeeting && (
          <div className="border-b border-border bg-white px-4 md:px-6 py-3 md:py-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {/* Mobile toggles - sidebar and transcript */}
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
                <div className="flex items-center gap-2 flex-wrap">
                  {editingTitle ? (
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Input
                        value={titleValue}
                        onChange={(event) => setTitleValue(event.target.value)}
                        className="text-lg md:text-xl font-semibold h-9 max-w-full sm:max-w-md"
                        autoFocus
                        onKeyDown={(event) => {
                          if (event.key === "Enter") handleSaveTitle()
                          if (event.key === "Escape") setEditingTitle(false)
                        }}
                      />
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={handleSaveTitle}>
                        <Check className="w-4 h-4 text-green-600" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 shrink-0" onClick={() => setEditingTitle(false)}>
                        <X className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <h1 className="text-lg md:text-xl font-semibold text-foreground line-clamp-1">
                        {selectedMeeting.title}
                      </h1>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleStartEditTitle} disabled={isProcessing || isFailed}>
                        <Pencil className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 md:gap-4 mt-2 text-xs md:text-sm text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    {selectedMeeting.date}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {selectedMeeting.time}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {selectedMeeting.duration}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    {session ? speakers.length : selectedMeeting.participants.length} {isRTL ? "משתתפים" : "participants"}
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
                {session?.transcript?.full_text && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="hidden sm:flex"
                    onClick={() => {
                      const transcript = session.transcript?.segments?.map((segment) => {
                        const name = segment.speaker_name || segment.speaker_id
                        return `[${formatDuration(segment.start_time)}] ${name}: ${segment.text}`
                      })
                      const blob = new Blob([transcript?.join("\n\n") || ""], { type: "text/plain;charset=utf-8" })
                      const url = URL.createObjectURL(blob)
                      const anchor = document.createElement("a")
                      anchor.href = url
                      anchor.download = `${selectedMeeting?.title}.txt`
                      anchor.click()
                      URL.revokeObjectURL(url)
                    }}
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden lg:inline ms-2">{isRTL ? "הורד" : "Download"}</span>
                  </Button>
                )}
                <Button
                  variant={showDocuments ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowDocuments(!showDocuments)}
                  className={showDocuments ? "bg-teal-600 hover:bg-teal-700" : ""}
                  disabled={isProcessing || isFailed}
                >
                  <FileText className="w-4 h-4" />
                  <span className="hidden lg:inline ms-2">{isRTL ? "מסמכים" : "Docs"}</span>
                </Button>
                <Button
                  variant={showChat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setShowChat(!showChat)}
                  className={showChat ? "bg-teal-600 hover:bg-teal-700" : ""}
                  disabled={!!isProcessing || !!isFailed}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden lg:inline ms-2">{isRTL ? "צ׳אט" : "Chat"}</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={isRTL ? "start" : "end"}>
                    {session?.transcript?.full_text && (
                      <DropdownMenuItem
                        onClick={() => {
                          const transcript = session.transcript?.segments?.map((segment) => {
                            const name = segment.speaker_name || segment.speaker_id
                            return `[${formatDuration(segment.start_time)}] ${name}: ${segment.text}`
                          })
                          const blob = new Blob([transcript?.join("\n\n") || ""], { type: "text/plain;charset=utf-8" })
                          const url = URL.createObjectURL(blob)
                          const anchor = document.createElement("a")
                          anchor.href = url
                          anchor.download = `${selectedMeeting.title}.txt`
                          anchor.click()
                          URL.revokeObjectURL(url)
                        }}
                      >
                        <Download className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                        {isRTL ? "הורד תמליל" : "Download transcript"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-red-600 focus:text-red-600">
                      <Trash2 className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                      {isRTL ? "מחק פגישה" : "Delete meeting"}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            {/* Audio Player - Under title */}
            {session?.audio_url && (
              <div className="mt-3 pt-3 border-t border-border">
                <AudioPlayer src={session.audio_url} />
              </div>
            )}
          </div>
        )}

        {isProcessing && !isStuck && (
          <div className="mx-4 md:mx-6 mt-4 px-3 py-2 rounded-lg border border-teal-200 bg-teal-50/50 flex items-center gap-3">
            <span className="text-sm text-teal-700 whitespace-nowrap">{isRTL ? "מעבד:" : "Processing:"}</span>
            <ProcessingStepper
              steps={(session?.processing_steps || []).map(s => ({ step: s.step as ProcessingStepKey, status: s.status as ProcessingStepStatus }))}
            />
            {/* Show "Transcript ready" indicator during enhancement phase */}
            {isEnhancingState && hasTranscript && (
              <span className="text-xs text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                {isRTL ? "✓ תמליל מוכן" : "✓ Transcript ready"}
              </span>
            )}
          </div>
        )}

        {isStuck && (
          <Card className="mx-4 md:mx-6 mt-4 border-orange-200 bg-orange-50/50">
            <CardContent className="p-3 md:p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <div>
                    <h3 className="font-medium text-orange-800">{isRTL ? "העיבוד נתקע" : "Processing Stuck"}</h3>
                    <p className="text-sm text-orange-700">
                      {isRTL ? "העיבוד לוקח יותר זמן מהרגיל. ניתן לנסות שוב." : "Processing is taking longer than expected. You can retry."}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleRetryProcessing}
                  className="border-orange-300 text-orange-700 hover:bg-orange-100 bg-transparent"
                  disabled={!(session?.audio_url ?? selectedMeeting?.audioUrl) || isRetrying}
                >
                  <RefreshCw className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2", isRetrying && "animate-spin")} />
                  {isRetrying ? (isRTL ? "מעבד..." : "Processing...") : (isRTL ? "נסה שוב" : "Retry")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {isDraft && (
          <div className="mx-4 md:mx-6 mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium text-amber-900 text-sm">{isRTL ? "הפגישה נשמרה כטיוטה" : "Meeting saved as draft"}</span>
                <span className="text-amber-700 text-sm">{isRTL ? "העיבוד לא התחיל." : "Processing has not started."}</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStartTranscription}
              className="border-amber-300 text-amber-800 hover:bg-amber-100 bg-transparent flex-shrink-0"
              disabled={!(session?.audio_url ?? selectedMeeting?.audioUrl) || isRetrying}
            >
              {isRetrying && <Loader2 className={cn("w-4 h-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />}
              {isRetrying ? (isRTL ? "מתחיל..." : "Starting...") : (isRTL ? "התחל עיבוד" : "Start processing")}
            </Button>
          </div>
        )}

        {isPendingWithAudio && (
          <div className="mx-4 md:mx-6 mt-4 p-3 rounded-lg border border-blue-200 bg-blue-50/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileAudio className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium text-blue-900 text-sm">{isRTL ? "ממתין לעיבוד" : "Waiting for processing"}</span>
                <span className="text-blue-700 text-sm">{isRTL ? "הקובץ מוכן. לחץ להתחיל תמלול." : "Audio file ready. Click to start transcription."}</span>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleStartTranscription}
              className="border-blue-300 text-blue-800 hover:bg-blue-100 bg-transparent flex-shrink-0"
              disabled={!(session?.audio_url ?? selectedMeeting?.audioUrl) || isRetrying}
            >
              {isRetrying && <Loader2 className={cn("w-4 h-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />}
              {isRetrying ? (isRTL ? "מתחיל..." : "Starting...") : (isRTL ? "התחל תמלול" : "Start Transcription")}
            </Button>
          </div>
        )}

        {isFailed && (
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
                  disabled={!(session?.audio_url ?? selectedMeeting?.audioUrl) || isRetrying}
                >
                  <RefreshCw className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2", isRetrying && "animate-spin")} />
                  {isRetrying ? (isRTL ? "מעבד..." : "Processing...") : (isRTL ? "נסה שוב" : "Retry")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex-1 overflow-auto p-3 md:p-6">
          {isLoadingSessions ? (
            <div className="p-4 md:p-6">
              <MeetingSkeleton />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <Card className="max-w-xl w-full">
                <CardContent className="p-6 space-y-4">
                  <h2 className="text-lg font-semibold">{isRTL ? "אין פגישות עדיין" : "No meetings yet"}</h2>
                  <p className="text-sm text-muted-foreground">
                    {isRTL
                      ? "צור פגישה חדשה כדי להתחיל."
                      : "Create a new meeting to get started."}
                  </p>
                  <Button asChild className="bg-teal-600 hover:bg-teal-700 text-white">
                    <Link href="/meetings/new">{isRTL ? "פגישה חדשה" : "New meeting"}</Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (isLoadingSessionDetail || isRefetchingSession) && !session ? (
            <div className="p-4 md:p-6">
              <MeetingSkeleton />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="lg:col-span-2">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        {summaryText && !editingSummary && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => {
                              setEditedOverviewText(summaryText || "")
                              setEditingSummary(true)
                            }}
                            disabled={!!isProcessing || !!isFailed}
                            aria-label={isRTL ? "ערוך סיכום" : "Edit summary"}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {editingSummary && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="default"
                              size="sm"
                              className="h-7 px-2"
                              onClick={handleSaveSummary}
                              disabled={savingSummary}
                            >
                              {savingSummary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2"
                              onClick={() => setEditingSummary(false)}
                              disabled={savingSummary}
                            >
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <Badge variant="secondary" className="bg-teal-50 text-teal-700 hover:bg-teal-50">
                        {isRTL ? "AI סיכום" : "AI Summary"}
                      </Badge>
                    </div>
                    {editingSummary ? (
                      <Textarea
                        value={editedOverviewText}
                        onChange={(e) => setEditedOverviewText(e.target.value)}
                        className="min-h-[100px] text-sm"
                        placeholder={isRTL ? "הזן סיכום..." : "Enter summary..."}
                        maxLength={5000}
                      />
                    ) : summaryText ? (
                      <div className="space-y-4">
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{summaryText}</p>
                        {session?.summary?.sections && Array.isArray(session.summary.sections) && session.summary.sections.length > 0 && (
                          <div className="space-y-3 pt-2">
                            {session.summary.sections.map((section: { title: string; bullets: string[] }, idx: number) => (
                              <div key={idx} className="space-y-2">
                                <h4 className="text-sm font-semibold text-foreground">{section.title}</h4>
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                  {section.bullets.map((bullet: string, bulletIdx: number) => (
                                    <li key={bulletIdx} className="flex gap-2">
                                      <span className="text-muted-foreground">•</span>
                                      <span className="flex-1">{bullet}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <StatusEmptyState status={getSectionStatus(session || selectedMeeting, !!summaryText, "summary")} />
                    )}
                  </CardContent>
                </Card>

                {/* Tasks Card */}
                <Card>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setShowNewTask(true)}
                        disabled={!!isProcessing || !!isFailed}
                        aria-label={isRTL ? "הוסף משימה" : "Add task"}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        {isRTL ? "משימות" : "Tasks"}
                        <span className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center">
                          <Calendar className="w-3.5 h-3.5 text-blue-700" />
                        </span>
                      </h3>
                    </div>
                    {actionItems.length > 0 ? (
                      <div className="space-y-1">
                        {actionItems.map((task) => (
                          <div
                            key={task.id}
                            className={cn(
                              "group flex items-center gap-3 text-sm p-2 rounded hover:bg-muted/50 transition-colors cursor-pointer",
                            )}
                          >
                            {editingTaskId === task.id && editingTask ? (
                              <div className="space-y-2">
                                <Input
                                  value={editingTask.description}
                                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                                  className="text-sm h-8"
                                />
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <Input
                                    value={editingTask.assignee}
                                    onChange={(e) => setEditingTask({ ...editingTask, assignee: e.target.value })}
                                    placeholder={isRTL ? "אחראי" : "Assignee"}
                                    className="text-sm flex-1 h-8"
                                  />
                                  <Input
                                    type="date"
                                    value={editingTask.deadline}
                                    onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                                    className="text-sm sm:w-32 h-8"
                                    dir="ltr"
                                  />
                                </div>
                                <div className="flex gap-1 justify-end">
                                  <Button size="sm" className="h-7" onClick={handleSaveTask} disabled={savingTask}>
                                    {savingTask ? <Loader2 className="w-3 h-3 animate-spin me-1" /> : null}
                                    {isRTL ? "שמור" : "Save"}
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingTaskId(null)} disabled={savingTask}>
                                    {isRTL ? "ביטול" : "Cancel"}
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className={cn("flex items-start gap-3", isRTL && "flex-row-reverse")}>
                                <Checkbox
                                  checked={completedTasks.has(task.id)}
                                  onCheckedChange={() => toggleTask(task.id)}
                                  className={cn(
                                    "mt-0.5 border-blue-400 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500",
                                    togglingTaskId === task.id && "opacity-50"
                                  )}
                                  disabled={togglingTaskId === task.id}
                                  aria-label={isRTL ? `סמן ${task.description} כהושלמה` : `Mark ${task.description} as complete`}
                                />
                                <div className="flex-1 min-w-0">
                                  <p
                                    className={cn(
                                      "text-sm font-medium",
                                      completedTasks.has(task.id) && "line-through text-muted-foreground",
                                    )}
                                  >
                                    {task.description}
                                  </p>
                                  <div className={cn("flex items-center gap-2 mt-1 text-xs text-muted-foreground", isRTL && "flex-row-reverse justify-end")}>
                                    {task.assignee && <span>{task.assignee}</span>}
                                    {task.deadline && <span dir="ltr">{new Date(task.deadline).toLocaleDateString(locale)}</span>}
                                  </div>
                                </div>
                                <div className="flex gap-0.5 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => handleEditTask(task)}
                                    aria-label={isRTL ? "ערוך משימה" : "Edit task"}
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-red-600"
                                    onClick={() => handleDeleteTask(task.id)}
                                    aria-label={isRTL ? "מחק משימה" : "Delete task"}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (isProcessing || isFailed || !showNewTask) ? (
                      <StatusEmptyState status={getSectionStatus(session || selectedMeeting, actionItems.length > 0, "tasks")} />
                    ) : null}
                    {showNewTask && (
                      <div className="p-2 rounded border border-border space-y-2 mt-1">
                        <Input
                          value={newTask.description}
                          onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                          placeholder={isRTL ? "משימה חדשה" : "New task"}
                          className="text-sm h-8"
                          autoFocus
                        />
                        <div className="flex flex-col sm:flex-row gap-2">
                          <Input
                            value={newTask.assignee}
                            onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })}
                            placeholder={isRTL ? "אחראי" : "Assignee"}
                            className="text-sm flex-1 h-8"
                          />
                          <Input
                            type="date"
                            value={newTask.deadline}
                            onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                            className="text-sm sm:w-32 h-8"
                            dir="ltr"
                          />
                        </div>
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" className="h-7" onClick={handleAddTask} disabled={savingTask}>
                            {savingTask ? <Loader2 className="w-3 h-3 animate-spin me-1" /> : null}
                            {isRTL ? "הוסף" : "Add"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setShowNewTask(false)} disabled={savingTask}>
                            {isRTL ? "ביטול" : "Cancel"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Decisions Card */}
                <Card>
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-center gap-2 mb-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => setShowNewDecision(true)}
                        disabled={!!isProcessing || !!isFailed}
                        aria-label={isRTL ? "הוסף החלטה" : "Add decision"}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        {isRTL ? "החלטות" : "Decisions"}
                        <span className="w-6 h-6 rounded bg-amber-100 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 text-amber-700" />
                        </span>
                      </h3>
                    </div>
                    {localDecisions.length > 0 ? (
                      <div className="space-y-1">
                        {localDecisions.map((decision, index) => (
                          <div key={decision.id} className={cn("flex gap-2 p-2 bg-white border border-border border-l-4 border-l-amber-400 rounded group text-sm items-start", isRTL && "flex-row-reverse")}>
                            {editingDecisionId === decision.id ? (
                              <div className="flex-1 flex items-center gap-1">
                                <Input
                                  value={editingDecisionText}
                                  onChange={(e) => setEditingDecisionText(e.target.value)}
                                  className="flex-1 text-sm h-7"
                                  autoFocus
                                  disabled={savingDecision}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleSaveDecision()
                                    if (e.key === "Escape") setEditingDecisionId(null)
                                  }}
                                />
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleSaveDecision} disabled={savingDecision}>
                                  {savingDecision ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3 text-green-600" />}
                                </Button>
                                <Button variant="ghost" size="sm" className={cn("h-6 w-6 p-0", savingDecision && "opacity-50 cursor-not-allowed")} onClick={() => setEditingDecisionId(null)} disabled={savingDecision} aria-label={isRTL ? "ביטול" : "Cancel"}>
                                  <X className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <p className="flex-1 text-foreground">{decision.description}</p>
                                <div className="flex items-center gap-1">
                                  <div className="flex gap-0.5 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => handleEditDecision(decision)}
                                      aria-label={isRTL ? "ערוך" : "Edit"}
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-600"
                                      onClick={() => handleDeleteDecision(decision.id)}
                                      aria-label={isRTL ? "מחק" : "Delete"}
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                  <span className="w-6 h-6 rounded-full bg-amber-200 text-amber-800 flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                                    {index + 1}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (isProcessing || isFailed || !showNewDecision) ? (
                      <StatusEmptyState status={getSectionStatus(session || selectedMeeting, localDecisions.length > 0, "decisions")} />
                    ) : null}
                    {showNewDecision && (
                      <div className="flex gap-2 p-2 bg-white border border-border rounded mt-1">
                        <Input
                          value={newDecisionText}
                          onChange={(e) => setNewDecisionText(e.target.value)}
                          placeholder={isRTL ? "החלטה חדשה..." : "New decision..."}
                          className="flex-1 text-sm h-8"
                          autoFocus
                          disabled={savingDecision}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddDecision()
                            if (e.key === "Escape") setShowNewDecision(false)
                          }}
                        />
                        <Button size="sm" className="h-8" onClick={handleAddDecision} disabled={savingDecision}>
                          {savingDecision ? <Loader2 className="w-3 h-3 animate-spin me-1" /> : null}
                          {isRTL ? "הוסף" : "Add"}
                        </Button>
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

                    {unnamedSpeakers.length > 0 && (
                      <p className="text-xs text-rose-600 mb-3 ms-8">
                        {isRTL
                          ? "הקצאת שמות תאפשר חיפוש ותובנות מדויקות יותר"
                          : "Assigning names will enable more accurate search and insights"}
                      </p>
                    )}

                    {isProcessing || isEnhancingState ? (
                      <StatusEmptyState status={isEnhancingState ? "enhancing" : "processing"} section={isRTL ? "דוברים" : "Speakers"} />
                    ) : speakers.length > 0 ? (
                      <div className="flex flex-wrap gap-3">
                        {speakers.map((speaker) => {
                          const speakerColor = getSpeakerColor(speaker.speakerId)
                          return (
                            <div key={speaker.speakerId} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg group">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className={cn(speakerColor.bg, speakerColor.text, "text-xs")}>
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
                                    list={mergedSuggestions.length > 0 ? "speaker-suggestions" : undefined}
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
                                    <p className="text-xs text-muted-foreground">{speaker.segmentCount} {isRTL ? "קטעים" : "segments"}</p>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 md:opacity-0 group-hover:opacity-100 transition-opacity"
                                        aria-label={isRTL ? `פעולות עבור ${speaker.speakerName}` : `Actions for ${speaker.speakerName}`}
                                      >
                                        <MoreHorizontal className="w-3 h-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => handleEditSpeaker(speaker)}>
                                        <Pencil className="w-3 h-3 me-2" />
                                        {isRTL ? "שנה שם" : "Rename"}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => handleOpenMerge(speaker)}>
                                        <GitMerge className="w-3 h-3 me-2" />
                                        {isRTL ? "מזג עם דובר אחר" : "Merge with another"}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => {
                                          // TODO: API call to delete speaker
                                          toast({ title: isRTL ? "דובר נמחק" : "Speaker deleted" })
                                        }}
                                        className="text-red-600"
                                      >
                                        <Trash2 className="w-3 h-3 me-2" />
                                        {isRTL ? "מחק" : "Delete"}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground ms-8">{isRTL ? "לא זוהו דוברים" : "No speakers identified"}</p>
                    )}
                    {mergedSuggestions.length > 0 && (
                      <datalist id="speaker-suggestions">
                        {mergedSuggestions.map((name) => (
                          <option key={name} value={name} />
                        ))}
                      </datalist>
                    )}
                  </CardContent>
                </Card>

                {showDocuments && session && (
                  <Card className="lg:col-span-2 overflow-hidden">
                    {isProcessing || isFailed || session.processing_state === "draft" ? (
                      <StatusEmptyState
                        status={getSectionStatus(session, false)}
                        section={isRTL ? "מסמכים" : "Documents"}
                      />
                    ) : (
                      <DocumentsPanel sessionId={session.id} />
                    )}
                  </Card>
                )}

                {showChat && session && (
                  <Card className="lg:col-span-2 overflow-hidden h-[520px]">
                    {isProcessing || isFailed || session.processing_state === "draft" ? (
                      <StatusEmptyState
                        status={getSectionStatus(session, false)}
                        section={isRTL ? "צ׳אט" : "Chat"}
                      />
                    ) : (
                      <MeetingChat sessionId={session.id} isProcessing={!!isProcessing} />
                    )}
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Collapsible Transcript Side Panel - Desktop only */}
      <div
        className={cn(
          "flex-shrink-0 border-s border-border bg-white transition-all duration-300",
          showTranscript ? "w-72 lg:w-80" : "w-10",
          "hidden md:flex flex-col",
        )}
      >
        {showTranscript ? (
          <>
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="font-medium text-sm">{isRTL ? "תמליל" : "Transcript"}</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => setShowTranscript(false)}
              >
                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              {session && isTranscribing ? (
                <StatusEmptyState status="processing" section={isRTL ? "התמליל" : "Transcript"} />
              ) : transcriptItems.length > 0 ? (
                <TranscriptPanel
                  transcript={transcriptItems}
                  speakerNames={Object.fromEntries(speakerNames)}
                  onSpeakerNameChange={handleSpeakerNameChange}
                  nameSuggestions={mergedSuggestions}
                  highlightedSegmentId={highlightedSegmentId}
                />
              ) : (
                <StatusEmptyState status="empty_transcript" />
              )}
            </div>
          </>
        ) : (
          <button
            onClick={() => setShowTranscript(true)}
            className="flex-1 flex items-center justify-center hover:bg-muted/50 transition-colors w-10"
            aria-label={isRTL ? "פתח תמליל" : "Open transcript"}
          >
            <span
              className="text-sm font-medium text-muted-foreground"
              style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
            >
              {isRTL ? "תמליל" : "Transcript"}
            </span>
          </button>
        )}
      </div>

      {/* Delete Meeting Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "מחיקת פגישה" : "Delete Meeting"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `האם אתה בטוח שברצונך למחוק את הפגישה "${selectedMeeting?.title}"?`
                : `Are you sure you want to delete "${selectedMeeting?.title}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deletingMeeting}>
              {isRTL ? "ביטול" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deletingMeeting}>
              {deletingMeeting ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
              {isRTL ? "מחק" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Decision Confirmation Dialog */}
      <Dialog open={showDeleteDecisionDialog} onOpenChange={setShowDeleteDecisionDialog}>
        <DialogContent dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "מחיקת החלטה" : "Delete Decision"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? "האם אתה בטוח שברצונך למחוק החלטה זו?"
                : "Are you sure you want to delete this decision?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={() => setShowDeleteDecisionDialog(false)} disabled={savingDecision}>
              {isRTL ? "ביטול" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteDecision} disabled={savingDecision}>
              {savingDecision ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
              {isRTL ? "מחק" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Task Confirmation Dialog */}
      <Dialog open={showDeleteTaskDialog} onOpenChange={setShowDeleteTaskDialog}>
        <DialogContent dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "מחיקת משימה" : "Delete Task"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? "האם אתה בטוח שברצונך למחוק משימה זו?"
                : "Are you sure you want to delete this task?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={() => setShowDeleteTaskDialog(false)} disabled={savingTask}>
              {isRTL ? "ביטול" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleConfirmDeleteTask} disabled={savingTask}>
              {savingTask ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
              {isRTL ? "מחק" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge Speakers Dialog */}
      <Dialog open={showMergeDialog} onOpenChange={setShowMergeDialog}>
        <DialogContent dir={isRTL ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{isRTL ? "מיזוג דוברים" : "Merge Speakers"}</DialogTitle>
            <DialogDescription>
              {isRTL
                ? `בחר את הדובר שאליו תרצה למזג את "${mergeSource?.speakerName}"`
                : `Select which speaker to merge "${mergeSource?.speakerName}" into`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-4" role="radiogroup" aria-label={isRTL ? "בחר דובר יעד" : "Select target speaker"}>
            {speakers
              .filter((p) => p.speakerId !== mergeSource?.speakerId)
              .map((p) => (
                <label
                  key={p.speakerId}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    mergeTarget === p.speakerId ? "border-teal-500 bg-teal-50" : "border-border hover:bg-muted/50",
                  )}
                >
                  <input
                    type="radio"
                    name="mergeTarget"
                    value={p.speakerId}
                    checked={mergeTarget === p.speakerId}
                    onChange={() => setMergeTarget(p.speakerId)}
                    className="sr-only"
                    aria-label={p.speakerName}
                  />
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                      {getInitials(p.speakerName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{p.speakerName}</span>
                </label>
              ))}
          </div>
          <DialogFooter className={cn("gap-2", isRTL && "flex-row-reverse")}>
            <Button variant="outline" onClick={() => setShowMergeDialog(false)} disabled={mergingSpeakers}>
              {isRTL ? "ביטול" : "Cancel"}
            </Button>
            <Button onClick={handleMergeParticipants} disabled={!mergeTarget || mergingSpeakers}>
              {mergingSpeakers ? <Loader2 className="w-4 h-4 animate-spin me-2" /> : null}
              {isRTL ? "מזג" : "Merge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div >
  )
}
