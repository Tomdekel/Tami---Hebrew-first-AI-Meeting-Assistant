"use client"

import { use, useState, useCallback, useEffect } from "react"
import { useTranslations, useLocale } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Edit2,
  FileDown,
  MessageSquare,
  FileText,
  Users,
  MoreVertical,
  X,
  Download,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { useSession, updateSession, deleteSession, startTranscription } from "@/hooks/use-session"
import {
  MeetingsSidebar,
  AIInsightsPanel,
  TranscriptPanel,
  DocumentsPanel,
  MeetingChat,
  AudioPlayer,
  AudioPlayerProvider,
  useAudioPlayer,
} from "@/components/meetings-v2"
import type { Speaker, Attachment } from "@/components/meetings-v2"
import type { ActionItem, Summary, TranscriptSegment, Session } from "@/lib/types/database"

interface PageProps {
  params: Promise<{ id: string }>
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--"
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, "0")}`
}

function formatDate(dateString: string, locale: string = "he"): string {
  const date = new Date(dateString)
  return date.toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function formatTime(dateString: string, locale: string = "he"): string {
  const date = new Date(dateString)
  return date.toLocaleTimeString(locale === "he" ? "he-IL" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

// Wrapper component to provide AudioPlayer context
export default function MeetingDetailPageV2Wrapper({ params }: PageProps) {
  return (
    <AudioPlayerProvider>
      <MeetingDetailPageV2Content params={params} />
    </AudioPlayerProvider>
  )
}

function MeetingDetailPageV2Content({ params }: PageProps) {
  const { id } = use(params)
  const t = useTranslations()
  const locale = useLocale()
  const router = useRouter()
  const audioPlayer = useAudioPlayer()
  const { session, isLoading, error, refetch } = useSession(id, { pollWhileProcessing: true })

  // UI states
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [audioCurrentTime, setAudioCurrentTime] = useState(0)
  const [chatOpen, setChatOpen] = useState(false)
  const [docsOpen, setDocsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Data states
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [speakersLoaded, setSpeakersLoaded] = useState(false)
  const [actionItems, setActionItems] = useState<ActionItem[]>([])
  const [actionItemsLoaded, setActionItemsLoaded] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [attachmentsLoaded, setAttachmentsLoaded] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionsLoaded, setSessionsLoaded] = useState(false)

  // Local summary state for optimistic updates
  const [localSummary, setLocalSummary] = useState<Summary | null>(null)

  // Sync summary from session
  useEffect(() => {
    if (session?.summary) {
      setLocalSummary(session.summary)
    }
  }, [session?.summary])

  // Load speakers
  const loadSpeakers = useCallback(async () => {
    if (speakersLoaded) return
    try {
      const response = await fetch(`/api/sessions/${id}/speakers`)
      if (response.ok) {
        const data = await response.json()
        setSpeakers(data.speakers || [])
        setSpeakersLoaded(true)
      }
    } catch (err) {
      console.error("Failed to load speakers:", err)
    }
  }, [id, speakersLoaded])

  // Load action items
  const loadActionItems = useCallback(async () => {
    if (actionItemsLoaded) return
    try {
      const response = await fetch(`/api/sessions/${id}/action-items`)
      if (response.ok) {
        const data = await response.json()
        setActionItems(
          (data.actionItems || []).map((item: {
            id: string
            description: string
            assignee: string | null
            deadline: string | null
            completed: boolean
            createdAt: string
            updatedAt: string
          }) => ({
            id: item.id,
            summary_id: "",
            description: item.description,
            assignee: item.assignee,
            deadline: item.deadline,
            completed: item.completed,
            created_at: item.createdAt,
            updated_at: item.updatedAt,
          }))
        )
        setActionItemsLoaded(true)
      }
    } catch (err) {
      console.error("Failed to load action items:", err)
    }
  }, [id, actionItemsLoaded])

  // Load attachments
  const loadAttachments = useCallback(async () => {
    if (attachmentsLoaded) return
    try {
      const response = await fetch(`/api/sessions/${id}/attachments`)
      if (response.ok) {
        const data = await response.json()
        setAttachments(data.attachments || [])
        setAttachmentsLoaded(true)
      }
    } catch (err) {
      console.error("Failed to load attachments:", err)
    }
  }, [id, attachmentsLoaded])

  // Load all sessions for sidebar
  const loadSessions = useCallback(async () => {
    if (sessionsLoaded) return
    try {
      const response = await fetch("/api/sessions?limit=50")
      if (response.ok) {
        const data = await response.json()
        setSessions(data.sessions || [])
        setSessionsLoaded(true)
      }
    } catch (err) {
      console.error("Failed to load sessions:", err)
    }
  }, [sessionsLoaded])

  // Load data on mount
  useEffect(() => {
    loadSpeakers()
    loadActionItems()
    loadSessions()
  }, [loadSpeakers, loadActionItems, loadSessions])

  // Load attachments when panel opens
  useEffect(() => {
    if (docsOpen) {
      loadAttachments()
    }
  }, [docsOpen, loadAttachments])

  const handleStartTranscription = async () => {
    setIsTranscribing(true)
    try {
      await startTranscription(id)
      toast.success("התמלול התחיל")
      refetch()
    } catch (err) {
      toast.error(t("common.error"), {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    } finally {
      setIsTranscribing(false)
    }
  }

  const handleSaveTitle = async () => {
    try {
      await updateSession(id, { title: editTitle })
      toast.success("הכותרת עודכנה")
      setIsEditing(false)
      refetch()
    } catch (err) {
      toast.error(t("common.error"), {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await deleteSession(id)
      toast.success("הפגישה נמחקה")
      router.push("/meetings")
    } catch (err) {
      toast.error(t("common.error"), {
        description: err instanceof Error ? err.message : "Unknown error",
      })
      setIsDeleting(false)
    }
  }

  const handleExport = async (format: "html" | "markdown", includeTranscript: boolean = false) => {
    setIsExporting(true)
    try {
      const url = `/api/sessions/${id}/export?format=${format}&includeTranscript=${includeTranscript}`
      const response = await fetch(url)

      if (!response.ok) throw new Error("Failed to export")

      const blob = await response.blob()
      const filename =
        response.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ||
        `meeting.${format === "html" ? "html" : "md"}`

      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)

      toast.success(t("export.success"))
    } catch (err) {
      toast.error(t("export.failed"))
    } finally {
      setIsExporting(false)
    }
  }

  const handleEditSpeaker = async (speakerId: string, newName: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}/speakers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speakerId, speakerName: newName }),
      })

      if (!response.ok) throw new Error("Failed to update speaker")

      toast.success(t("speakers.renamed"))
      setSpeakersLoaded(false)
      loadSpeakers()
      refetch()
    } catch (err) {
      toast.error(t("speakers.renameFailed"))
    }
  }

  const handleSeek = useCallback((time: number) => {
    audioPlayer.seekTo(time)
  }, [audioPlayer])

  const handleRefresh = () => {
    setSpeakersLoaded(false)
    setActionItemsLoaded(false)
    loadSpeakers()
    loadActionItems()
    refetch()
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">{t("meeting.sessionNotFound")}</p>
        <Button asChild>
          <Link href="/meetings">{t("meeting.backToMeetings")}</Link>
        </Button>
      </div>
    )
  }

  const hasTranscript = session.transcript && session.transcript.segments?.length > 0
  const isProcessing = session.status === "processing" || session.status === "refining"
  const transcriptSegments: TranscriptSegment[] =
    session.transcript?.segments?.map((seg) => ({
      id: seg.id || "",
      transcript_id: seg.transcript_id || "",
      speaker_id: seg.speaker_id,
      speaker_name: seg.speaker_name || seg.speaker_id,
      text: seg.text,
      start_time: seg.start_time,
      end_time: seg.end_time,
      segment_order: seg.segment_order,
      is_deleted: seg.is_deleted,
    })) || []

  const participantCount = speakers.length || (hasTranscript ? new Set(transcriptSegments.map((s) => s.speaker_id)).size : 0)

  return (
    <div className="h-screen flex flex-col bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-border px-6 py-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t("meeting.meetingTitle")}
                  className="text-xl font-semibold h-auto py-1 max-w-md"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle()
                    if (e.key === "Escape") setIsEditing(false)
                  }}
                />
                <Button size="sm" onClick={handleSaveTitle}>
                  {t("common.save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold">{session.title || t("meeting.untitled")}</h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditTitle(session.title || "")
                    setIsEditing(true)
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(session.duration_seconds)}
              </span>
              <span>·</span>
              <span>{formatTime(session.created_at, locale)}</span>
              <span>·</span>
              <span>{formatDate(session.created_at, locale)}</span>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {participantCount} {t("meeting.speakers")}
              </span>
              {session.status !== "completed" && (
                <>
                  <span>·</span>
                  <Badge
                    variant={session.status === "failed" || session.status === "expired" ? "destructive" : "secondary"}
                    className="text-xs"
                  >
                    {session.status === "processing" && (
                      <Loader2 className="h-3 w-3 me-1 animate-spin" />
                    )}
                    {(session.status === "failed" || session.status === "expired") && (
                      <AlertCircle className="h-3 w-3 me-1" />
                    )}
                    {session.status === "pending" && t("meeting.pending")}
                    {session.status === "processing" && t("meeting.processing")}
                    {session.status === "refining" && t("meeting.refining")}
                    {session.status === "failed" && t("meeting.failed")}
                    {session.status === "expired" && t("meeting.timedOut")}
                  </Badge>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setChatOpen(true)} aria-label={t("meeting.openChat")}>
              <MessageSquare className="h-4 w-4 me-1" />
              {t("meeting.chat")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDocsOpen(true)} aria-label={t("meeting.openDocuments")}>
              <FileText className="h-4 w-4 me-1" />
              {t("meeting.documents")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting} aria-label={t("meeting.downloadFile")}>
                  <Download className="h-4 w-4 me-1" />
                  {t("meeting.download")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("html", false)}>
                  <FileDown className="h-4 w-4 me-2" />
                  {t("export.summaryOnly")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("html", true)}>
                  <FileText className="h-4 w-4 me-2" />
                  {t("export.withTranscript")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 me-2" />
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Audio Player */}
      {session.audio_url && (
        <AudioPlayer src={session.audio_url} onTimeUpdate={setAudioCurrentTime} />
      )}

      {/* Processing States */}
      {session.status === "pending" && session.audio_url && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-medium">{t("meeting.readyToTranscribe")}</h3>
            <p className="text-sm text-muted-foreground">
              {t("meeting.clickToStartTranscription")}
            </p>
          </div>
          <Button onClick={handleStartTranscription} disabled={isTranscribing}>
            {isTranscribing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t("meeting.startTranscription")}
          </Button>
        </div>
      )}

      {(session.status === "failed" || session.status === "expired") && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <div>
              <h3 className="font-medium text-destructive">
                {session.status === "expired"
                  ? t("meeting.transcriptionTimedOut")
                  : t("meeting.transcriptionFailed")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {session.status === "expired"
                  ? t("meeting.transcriptionTimeoutDesc")
                  : t("meeting.transcriptionError")}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleStartTranscription} disabled={isTranscribing}>
            <RefreshCw className="h-4 w-4 me-2" />
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* Main Content: 3-Panel Layout (RTL: Sidebar-right, Transcript-center, AI-left) */}
      <div className="flex-1 overflow-hidden">
        {/* Desktop: 3-column grid */}
        {/* Mobile: Stack panels vertically */}
        <div className="h-full grid grid-cols-1 lg:grid-cols-[300px_1fr_320px]">
          {/* RIGHT (in RTL visual): Meetings Sidebar - first in DOM, renders on right in RTL */}
          <div className="h-full border-s border-border overflow-hidden order-3 lg:order-1">
            <MeetingsSidebar
              sessions={sessions}
              selectedId={id}
              onSelect={(sessionId) => router.push(`/meetings/${sessionId}`)}
              isLoading={!sessionsLoaded}
            />
          </div>

          {/* CENTER: Transcript */}
          <div className="h-full border-s border-border overflow-hidden order-1 lg:order-2">
            <TranscriptPanel
              segments={transcriptSegments}
              currentTime={audioCurrentTime}
              onSeek={handleSeek}
              onEditSpeaker={handleEditSpeaker}
              status={session.status}
            />
          </div>

          {/* LEFT (in RTL visual): AI Insights Panel - last in DOM, renders on left in RTL */}
          <div className="h-full overflow-hidden order-2 lg:order-3">
            <AIInsightsPanel
              sessionId={id}
              summary={localSummary}
              speakers={speakers}
              actionItems={actionItems}
              isLoading={!speakersLoaded || !actionItemsLoaded}
              onSummaryChange={setLocalSummary}
              onActionItemsChange={setActionItems}
              onSpeakersChange={setSpeakers}
              onRefresh={handleRefresh}
            />
          </div>
        </div>
      </div>

      {/* Chat Sheet */}
      <Sheet open={chatOpen} onOpenChange={setChatOpen}>
        <SheetContent side="left" className="w-full sm:w-[450px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              שאל שאלה על הפגישה
            </SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-80px)]">
            <MeetingChat sessionId={id} isProcessing={isProcessing} onSeek={handleSeek} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Documents Sheet */}
      <Sheet open={docsOpen} onOpenChange={setDocsOpen}>
        <SheetContent side="left" className="w-full sm:w-[450px] p-0">
          <SheetHeader className="p-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {t("meeting.attachedDocuments")}
            </SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-80px)]">
            <DocumentsPanel
              sessionId={id}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              isLoading={!attachmentsLoaded}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("meeting.deleteMeeting")}</DialogTitle>
            <DialogDescription>{t("meeting.deleteConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
