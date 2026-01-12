"use client"

import { use, useState, useCallback, useEffect } from "react"
import { useTranslations, useLocale } from "next-intl"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Loader2,
  Clock,
  CheckCircle2,
  Check,
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
  Info,
  ChevronLeft,
  ChevronRight,
  Brain,
  Menu,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { cn } from "@/lib/utils"
import type { Speaker, Attachment } from "@/components/meetings-v2"
import type { ActionItem, Summary, TranscriptSegment, Session } from "@/lib/types/database"
import { SourceBadge } from "@/components/source-badge"
import { TranscriptionProgress } from "@/components/transcription-progress"

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
  const [showChat, setShowChat] = useState(false)
  const [showDocuments, setShowDocuments] = useState(false)
  // Transcript drawer is always open by default - user can close it during session
  const [showTranscript, setShowTranscript] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileActiveTab, setMobileActiveTab] = useState<"insights" | "transcript" | "chat" | "documents">("insights")

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

  // Load attachments when panel opens (desktop) or documents tab selected (mobile)
  useEffect(() => {
    if (showDocuments || mobileActiveTab === "documents") {
      loadAttachments()
    }
  }, [showDocuments, mobileActiveTab, loadAttachments])

  const handleStartTranscription = async () => {
    setIsTranscribing(true)
    try {
      await startTranscription(id)
      toast.success("התמלול התחיל")

      // Add small delay before refetch to let DB update (race condition fix)
      await new Promise(resolve => setTimeout(resolve, 500))
      await refetch()

      // If still pending after initial refetch, poll again after 2 seconds
      // This handles cases where the status update is slow
      setTimeout(async () => {
        await refetch()
      }, 2000)
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

  const handleDeleteFromSidebar = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
      toast.success("הפגישה נמחקה")
      // Remove from local sessions list
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      // If deleted the current session, redirect to meetings list
      if (sessionId === id) {
        router.push("/meetings")
      }
    } catch (err) {
      toast.error(t("common.error"), {
        description: err instanceof Error ? err.message : "Unknown error",
      })
      throw err // Re-throw so sidebar can handle loading state
    }
  }

  const handleExport = async (format: "html" | "markdown", includeTranscript: boolean = false) => {
    setIsExporting(true)
    try {
      const url = `/api/sessions/${id}/export?format=${format}&includeTranscript=${includeTranscript}`
      const response = await fetch(url)

      if (!response.ok) {
        let errorMessage = "Failed to export"
        try {
          const contentType = response.headers.get("Content-Type") || ""
          if (contentType.includes("application/json")) {
            const data = (await response.json()) as { error?: string }
            if (data?.error) {
              errorMessage = data.error
            }
          }
        } catch (parseError) {
          console.warn("Failed to parse export error", parseError)
        }
        throw new Error(errorMessage)
      }

      const blob = await response.blob()
      const fallbackTitle = session?.title?.trim() || "meeting"
      const defaultFilename = `${fallbackTitle}.${format === "html" ? "html" : "md"}`
      const filename =
        response.headers
          .get("Content-Disposition")
          ?.split("filename=")[1]
          ?.replace(/"/g, "") || defaultFilename

      const link = document.createElement("a")
      const objectUrl = URL.createObjectURL(blob)
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(objectUrl)

      toast.success(t("export.success"))
    } catch (err) {
      toast.error(t("export.failed"), {
        description: err instanceof Error ? err.message : "Unknown error",
      })
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
    <div className="flex h-[calc(100vh-3.5rem)] bg-background" dir={locale === "he" ? "rtl" : "ltr"}>
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <MeetingsSidebar
          sessions={sessions}
          selectedId={id}
          onSelect={(sessionId) => router.push(`/meetings/${sessionId}`)}
          onDelete={handleDeleteFromSidebar}
          isLoading={!sessionsLoaded}
        />
      </div>

      {/* Mobile Sidebar Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side={locale === "he" ? "right" : "left"} className="p-0 w-80">
          <SheetHeader className="p-4 border-b">
            <SheetTitle>{t("nav.meetings")}</SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100%-60px)]">
            <MeetingsSidebar
              sessions={sessions}
              selectedId={id}
              onSelect={(sessionId) => {
                router.push(`/meetings/${sessionId}`)
                setSidebarOpen(false)
              }}
              onDelete={handleDeleteFromSidebar}
              isLoading={!sessionsLoaded}
              className="w-full border-0"
            />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="border-b border-border bg-white px-6 py-4">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder={t("meeting.meetingTitle")}
                    className="text-xl font-semibold h-9 max-w-md"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveTitle()
                      if (e.key === "Escape") setIsEditing(false)
                    }}
                  />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSaveTitle}>
                    <Check className="w-4 h-4 text-green-600" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setIsEditing(false)}>
                    <X className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-xl font-semibold text-foreground truncate">
                    {session.title || t("meeting.untitled")}
                  </h1>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditTitle(session.title || "")
                      setIsEditing(true)
                    }}
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                <span>{formatDate(session.created_at, locale)}</span>
                <span>{formatTime(session.created_at, locale)}</span>
                <span>{formatDuration(session.duration_seconds)}</span>
                <span>
                  {participantCount} {t("meeting.speakers")}
                </span>
                {session.source_type && session.source_type !== "recorded" && (
                  <SourceBadge
                    sourceType={session.source_type}
                    confidence={session.ingestion_confidence}
                    showConfidence={true}
                  />
                )}
                {session.status !== "completed" && (
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
                )}
              </div>
              {session.context && (
                <div className="mt-2 flex items-start gap-2">
                  <Badge variant="secondary" className="text-xs bg-teal-50 text-teal-700 shrink-0">
                    <Info className="w-3 h-3 mr-1" />
                    {t("meeting.context")}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{session.context}</p>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Mobile: Hamburger menu to open sidebar */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden h-11 w-11 p-0"
                onClick={() => setSidebarOpen(true)}
                aria-label={t("nav.openSidebar")}
              >
                <Menu className="w-5 h-5" />
              </Button>

              {/* Desktop: Panel toggle buttons */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport("html", true)}
                disabled={isExporting}
                className="hidden lg:inline-flex"
              >
                {isExporting ? (
                  <Loader2 className={cn("w-4 h-4 animate-spin", locale === "he" ? "ml-2" : "mr-2")} />
                ) : (
                  <Download className={cn("w-4 h-4", locale === "he" ? "ml-2" : "mr-2")} />
                )}
                {t("meeting.download")}
              </Button>
              <Button
                variant={showDocuments ? "default" : "outline"}
                size="sm"
                onClick={() => setShowDocuments(!showDocuments)}
                className={cn("hidden lg:inline-flex", showDocuments ? "bg-teal-600 hover:bg-teal-700" : "")}
              >
                <FileText className={cn("w-4 h-4", locale === "he" ? "ml-2" : "mr-2")} />
                {t("meeting.documents")}
              </Button>
              <Button
                variant={showChat ? "default" : "outline"}
                size="sm"
                onClick={() => setShowChat(!showChat)}
                className={cn("hidden lg:inline-flex", showChat ? "bg-teal-600 hover:bg-teal-700" : "")}
              >
                <MessageSquare className={cn("w-4 h-4", locale === "he" ? "ml-2" : "mr-2")} />
                {t("meeting.chat")}
              </Button>
              <Button
                variant={showTranscript ? "default" : "outline"}
                size="sm"
                onClick={() => setShowTranscript(!showTranscript)}
                className={cn("hidden lg:inline-flex", showTranscript ? "bg-teal-600 hover:bg-teal-700" : "")}
              >
                {t("meeting.transcript")}
              </Button>

              {/* Actions dropdown - both mobile and desktop */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-11 w-11 lg:h-8 lg:w-8 p-0">
                    <MoreVertical className="w-5 h-5 lg:w-4 lg:h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Mobile: Export option in dropdown */}
                  <DropdownMenuItem
                    onClick={() => handleExport("html", true)}
                    disabled={isExporting}
                    className="lg:hidden min-h-11"
                  >
                    <Download className={cn("w-4 h-4", locale === "he" ? "ml-2" : "mr-2")} />
                    {t("meeting.download")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="lg:hidden" />
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive focus:text-destructive min-h-11 lg:min-h-0"
                  >
                    <Trash2 className={cn("w-4 h-4", locale === "he" ? "ml-2" : "mr-2")} />
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {session.audio_url && <AudioPlayer src={session.audio_url} onTimeUpdate={setAudioCurrentTime} />}

        {/* Progress indicator for pending/processing - centered, no manual button */}
        {(session.status === "pending" || session.status === "processing") && session.audio_url && (
          <div className="bg-teal-50 dark:bg-teal-950/30 border-b border-teal-200 dark:border-teal-800 px-6 py-4">
            <div className="flex items-center justify-center">
              <TranscriptionProgress status={session.status as "pending" | "processing"} />
            </div>
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

        {/* Mobile Tabs Layout - visible only on mobile */}
        <Tabs
          value={mobileActiveTab}
          onValueChange={(v) => setMobileActiveTab(v as typeof mobileActiveTab)}
          className="flex-1 flex flex-col overflow-hidden lg:hidden"
        >
          <TabsList className="flex-shrink-0 w-full h-12 p-1 bg-muted/50 border-b rounded-none justify-start gap-1">
            <TabsTrigger value="insights" className="flex-1 h-10 data-[state=active]:bg-white gap-2">
              <Brain className="w-4 h-4" />
              <span className="text-xs">{t("meeting.insights")}</span>
            </TabsTrigger>
            <TabsTrigger value="transcript" className="flex-1 h-10 data-[state=active]:bg-white gap-2">
              <FileText className="w-4 h-4" />
              <span className="text-xs">{t("meeting.transcript")}</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1 h-10 data-[state=active]:bg-white gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs">{t("meeting.chat")}</span>
            </TabsTrigger>
            <TabsTrigger value="documents" className="flex-1 h-10 data-[state=active]:bg-white gap-2">
              <FileDown className="w-4 h-4" />
              <span className="text-xs">{t("meeting.documents")}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="insights" forceMount className="flex-1 overflow-y-auto p-4 data-[state=inactive]:hidden">
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
          </TabsContent>

          <TabsContent value="transcript" forceMount className="flex-1 overflow-hidden data-[state=inactive]:hidden">
            <TranscriptPanel
              segments={transcriptSegments}
              currentTime={audioCurrentTime}
              onSeek={handleSeek}
              onEditSpeaker={handleEditSpeaker}
            />
          </TabsContent>

          <TabsContent value="chat" forceMount className="flex-1 overflow-hidden data-[state=inactive]:hidden">
            <MeetingChat sessionId={id} isProcessing={isProcessing} onSeek={handleSeek} />
          </TabsContent>

          <TabsContent value="documents" forceMount className="flex-1 overflow-hidden p-4 data-[state=inactive]:hidden">
            <DocumentsPanel
              sessionId={id}
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              isLoading={!attachmentsLoaded}
            />
          </TabsContent>
        </Tabs>

        {/* Desktop Layout - hidden on mobile */}
        <div className="hidden lg:flex flex-1 overflow-hidden">
          <div className="flex-1 min-w-0 overflow-y-auto p-6 bg-background">
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

          <div
            className={cn(
              "flex-shrink-0 border-l border-border bg-white transition-all duration-300",
              showTranscript ? "w-96" : "w-10"
            )}
          >
            {showTranscript ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between p-3 border-b border-border">
                  <h3 className="font-medium text-sm">{t("meeting.transcript")}</h3>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setShowTranscript(false)}>
                    {locale === "he" ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </Button>
                </div>
                <div className="flex-1 overflow-hidden">
                  <TranscriptPanel
                    segments={transcriptSegments}
                    currentTime={audioCurrentTime}
                    onSeek={handleSeek}
                    onEditSpeaker={handleEditSpeaker}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowTranscript(true)}
                className="h-full w-full flex items-center justify-center hover:bg-muted/50 transition-colors"
                title={t("meeting.transcript")}
              >
                <span
                  className="writing-mode-vertical text-xs text-muted-foreground font-medium"
                  style={{ writingMode: "vertical-rl", transform: locale === "he" ? "rotate(180deg)" : "none" }}
                >
                  {t("meeting.transcript")}
                </span>
              </button>
            )}
          </div>

          {showDocuments && (
            <div className="w-80 flex-shrink-0 border-l border-border bg-white">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-medium">{t("meeting.attachedDocuments")}</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowDocuments(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <DocumentsPanel
                sessionId={id}
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                isLoading={!attachmentsLoaded}
              />
            </div>
          )}

          {showChat && (
            <div className="w-80 flex-shrink-0 border-l border-border bg-white">
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-medium">{t("meeting.chat")}</h3>
                <Button variant="ghost" size="sm" onClick={() => setShowChat(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="h-[calc(100%-56px)]">
                <MeetingChat sessionId={id} isProcessing={isProcessing} onSeek={handleSeek} />
              </div>
            </div>
          )}
        </div>
      </div>

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
