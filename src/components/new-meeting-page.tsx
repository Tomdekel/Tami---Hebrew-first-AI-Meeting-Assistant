"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileAudio,
  FileText,
  Loader2,
  Mic,
  Monitor,
  Square,
  Upload,
  Users,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useLanguage } from "@/contexts/language-context"
import { useRecording, type RecordingMode as AudioMode, type AutoEndReason } from "@/hooks/use-recording"
import { uploadAudioBlob, uploadAudioChunk, combineAudioChunks, deleteAudioChunks, validateAudioForSpeech, formatValidationDetails } from "@/lib/audio"
import { createSession, startTranscription } from "@/hooks/use-session"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Waveform } from "@/components/recording/waveform"
import { IdleWaveform } from "@/components/recording/idle-waveform"
import { SUPPORTED_TRANSCRIPT_EXTENSIONS } from "@/lib/parsers"
import type { CalendarEvent } from "@/features/meeting-bots/types"
import { useInvalidateSessions } from "@/hooks/use-session-query"

const MIN_AUTO_TRANSCRIBE_DURATION = 60

// Feature flag: Calendar import (hidden until backend env vars are configured)
const SHOW_CALENDAR_IMPORT = false

type UploadType = "audio" | "transcript" | "record"
type UploadStatus = "idle" | "uploading" | "processing" | "complete" | "error"
type RecordingMode = "in-person" | "online" | null

type IntegrationProvider = "google" | "outlook" | "zoom" | "teams"
type IntegrationMode = "manual" | "suggested" | "auto"

interface UploadedFile {
  id: string
  name: string
  size: string
  status: UploadStatus
  progress: number
  sessionId?: string
  error?: string
}

const integrationCopy: Record<IntegrationProvider, { titleEn: string; titleHe: string; descEn: string; descHe: string; actionEn: string; actionHe: string }> = {
  google: {
    titleEn: "Connect Google Calendar",
    titleHe: "חיבור Google Calendar",
    descEn: "We only access your calendar to list meetings with recordings or transcripts. No bots will ever join meetings.",
    descHe: "ניגש ליומן רק כדי להציג פגישות עם הקלטות או תמלילים. אין בוטים שמצטרפים לפגישות.",
    actionEn: "Continue to Google",
    actionHe: "המשך ל-Google",
  },
  outlook: {
    titleEn: "Connect Outlook Calendar",
    titleHe: "חיבור Outlook Calendar",
    descEn: "We only access your calendar to list meetings with recordings or transcripts. No bots will ever join meetings.",
    descHe: "ניגש ליומן רק כדי להציג פגישות עם הקלטות או תמלילים. אין בוטים שמצטרפים לפגישות.",
    actionEn: "Continue to Outlook",
    actionHe: "המשך ל-Outlook",
  },
  zoom: {
    titleEn: "Connect Zoom",
    titleHe: "חיבור Zoom",
    descEn: "Requires Zoom OAuth setup to list recordings. This is not available yet.",
    descHe: "דורש חיבור OAuth ל-Zoom כדי להציג הקלטות. עדיין לא זמין.",
    actionEn: "Coming soon",
    actionHe: "בקרוב",
  },
  teams: {
    titleEn: "Connect Microsoft Teams",
    titleHe: "חיבור Microsoft Teams",
    descEn: "Requires Microsoft Graph setup to list recordings. This is not available yet.",
    descHe: "דורש חיבור Microsoft Graph כדי להציג הקלטות. עדיין לא זמין.",
    actionEn: "Coming soon",
    actionHe: "בקרוב",
  },
}

export function NewMeetingPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isRTL, language } = useLanguage()
  const { invalidateSessionsList } = useInvalidateSessions()

  const [uploadType, setUploadType] = useState<UploadType>("audio")
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingTitleError, setMeetingTitleError] = useState(false)
  const [meetingContext, setMeetingContext] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessingRecording, setIsProcessingRecording] = useState(false)
  const [recordingMode, setRecordingMode] = useState<RecordingMode>(null)
  const [audioMode, setAudioMode] = useState<AudioMode | null>(null)
  const [pastedTranscript, setPastedTranscript] = useState("")
  const [transcriptFile, setTranscriptFile] = useState<File | null>(null)
  const [transcriptStatus, setTranscriptStatus] = useState<UploadStatus>("idle")
  const [transcriptProgress, setTranscriptProgress] = useState(0)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)

  const [showShortMeetingDialog, setShowShortMeetingDialog] = useState(false)
  const [shortMeetingDuration, setShortMeetingDuration] = useState(0)
  const [pendingShortMeetingAction, setPendingShortMeetingAction] = useState<(() => Promise<void>) | null>(null)

  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationProvider | null>(null)
  const [integrationMode, setIntegrationMode] = useState<IntegrationMode>("manual")
  const [integrationEvents, setIntegrationEvents] = useState<CalendarEvent[]>([])
  const [integrationLoading, setIntegrationLoading] = useState(false)
  const [integrationError, setIntegrationError] = useState<string | null>(null)
  const [connectingProvider, setConnectingProvider] = useState<IntegrationProvider | null>(null)

  const chunkCountRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const completedRef = useRef(false)
  const failedChunksRef = useRef<Set<number>>(new Set())

  const meetingLanguage = language

  const generateDefaultTitle = useCallback(() => {
    const now = new Date()
    const dateStr = now.toLocaleDateString(isRTL ? "he-IL" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    const timeStr = now.toLocaleTimeString(isRTL ? "he-IL" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })
    return isRTL ? `הקלטה ${dateStr} ${timeStr}` : `Recording ${dateStr} ${timeStr}`
  }, [isRTL])

  useEffect(() => {
    const providerParam = searchParams.get("integration") as IntegrationProvider | null
    const connectedParam = searchParams.get("connected")
    if (providerParam && connectedParam === "1") {
      setSelectedIntegration(providerParam)
      void loadIntegrationEvents(providerParam)
    }
  }, [searchParams])

  const handleAutoEnd = useCallback((reason: AutoEndReason) => {
    if (reason === "pause_timeout") {
      toast.warning(
        isRTL
          ? "ההקלטה הסתיימה אוטומטית עקב השהייה ממושכת"
          : "Recording ended automatically due to extended pause",
        { duration: 8000 },
      )
    } else if (reason === "page_exit") {
      toast.info(isRTL ? "ההקלטה נשמרה" : "Recording saved", { duration: 5000 })
    }
  }, [isRTL])

  const getStatusIcon = (status: UploadStatus) => {
    switch (status) {
      case "uploading":
        return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
      case "processing":
        return <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
      case "complete":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <FileAudio className="w-4 h-4 text-muted-foreground" />
    }
  }

  const updateFileStatus = useCallback((fileId: string, updates: Partial<UploadedFile>) => {
    setUploadedFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f)))
  }, [])

  const processFile = useCallback(
    async (file: File, fileId: string, skipDurationCheck: boolean = false) => {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          updateFileStatus(fileId, { status: "error", error: isRTL ? "נדרש להתחבר" : "Please sign in" })
          return
        }

        updateFileStatus(fileId, { status: "uploading", progress: 10 })
        const validation = await validateAudioForSpeech(file)

        if (!validation.isValid) {
          console.log("Validation details:", formatValidationDetails(validation.details))
          updateFileStatus(fileId, { status: "error", error: validation.error })
          return
        }

        const estimatedDuration = validation.details.duration
        if (!skipDurationCheck && estimatedDuration < MIN_AUTO_TRANSCRIBE_DURATION && estimatedDuration > 0) {
          setShortMeetingDuration(estimatedDuration)
          setPendingShortMeetingAction(() => async () => {
            await processFile(file, fileId, true)
          })
          setShowShortMeetingDialog(true)
          updateFileStatus(fileId, { status: "idle", progress: 0 })
          return
        }

        updateFileStatus(fileId, { progress: 30 })

        const session = await createSession({
          title: meetingTitle || file.name.replace(/\.[^/.]+$/, ""),
          context: meetingContext || undefined,
          detected_language: meetingLanguage,
        })

        updateFileStatus(fileId, { progress: 50, sessionId: session.id })

        const audioResult = await uploadAudioBlob(file, user.id, session.id, file.name)

        await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio_url: audioResult.url,
            status: "pending",
            duration_seconds: Math.round(estimatedDuration),
          }),
        })

        updateFileStatus(fileId, { status: "processing", progress: 70 })

        await startTranscription(session.id)

        updateFileStatus(fileId, { status: "complete", progress: 100 })
        invalidateSessionsList()
        // Delay navigation to allow React Query cache to sync
        setTimeout(() => {
          router.push(`/meetings/${session.id}`)
        }, 500)
      } catch (error) {
        console.error("Upload failed:", error)
        updateFileStatus(fileId, {
          status: "error",
          error: error instanceof Error ? error.message : "Unknown error",
        })
      }
    },
    [meetingTitle, meetingContext, meetingLanguage, updateFileStatus, router, isRTL, invalidateSessionsList],
  )

  const handleFileUpload = useCallback(
    (files: FileList | null) => {
      if (!files) return
      if (!meetingTitle.trim()) {
        setMeetingTitleError(true)
        toast.error(isRTL ? "נדרש שם פגישה" : "Meeting title required", {
          description: isRTL ? "הזן שם לפגישה לפני העלאת קובץ" : "Enter a meeting title before uploading",
        })
        // Focus on the title field to draw attention
        document.getElementById("title")?.focus()
        return
      }

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
          toast.error(isRTL ? "קובץ לא נתמך" : "Unsupported file", {
            description: isRTL ? "אנא העלה קובץ שמע" : "Please upload an audio file",
          })
          return
        }

        const fileId = Date.now().toString() + Math.random().toString(36)
        const newFile: UploadedFile = {
          id: fileId,
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          status: "idle",
          progress: 0,
        }
        setUploadedFiles((prev) => [newFile, ...prev])
        void processFile(file, fileId)
      })
    },
    [meetingTitle, processFile, isRTL],
  )

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const handleRecordingComplete = useCallback(
    async (blob: Blob, skipDurationCheck: boolean = false, durationSecs?: number) => {
      setIsProcessingRecording(true)

      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          toast.error(isRTL ? "נדרש להתחבר" : "Please sign in")
          setIsProcessingRecording(false)
          return
        }

        toast.info(isRTL ? "בודק הקלטה" : "Validating recording")
        const validation = await validateAudioForSpeech(blob)

        if (!validation.isValid) {
          toast.error(isRTL ? "האימות נכשל" : "Validation failed", {
            description: validation.error,
            duration: 8000,
          })
          console.log("Validation details:", formatValidationDetails(validation.details))
          setIsProcessingRecording(false)
          failedChunksRef.current.clear()
          return
        }

        const actualDuration = durationSecs || validation.details.duration
        if (!skipDurationCheck && actualDuration < MIN_AUTO_TRANSCRIBE_DURATION && actualDuration > 0) {
          setShortMeetingDuration(actualDuration)
          setPendingShortMeetingAction(() => async () => {
            await handleRecordingComplete(blob, true, actualDuration)
          })
          setShowShortMeetingDialog(true)
          setIsProcessingRecording(false)
          return
        }

        toast.info(isRTL ? "מעבד הקלטה" : "Processing recording")

        let audioResult
        const hasFailedChunks = failedChunksRef.current.size > 0

        if (hasFailedChunks && chunkCountRef.current > 0) {
          toast.warning(isRTL ? "חלק מהחלקים נכשלו, מעלים הקלטה מלאה" : "Some chunks failed. Uploading full recording...", {
            duration: 5000,
          })
          if (sessionIdRef.current) {
            try {
              await deleteAudioChunks(user.id, sessionIdRef.current, chunkCountRef.current)
            } catch (cleanupError) {
              console.error("Failed to clean up chunks:", cleanupError)
            }
          }
        }

        if (chunkCountRef.current === 0 || hasFailedChunks || !sessionIdRef.current) {
          if (!sessionIdRef.current) {
            const session = await createSession({
              title: meetingTitle || generateDefaultTitle(),
              context: meetingContext || undefined,
              detected_language: meetingLanguage,
            })
            sessionIdRef.current = session.id
          }

          audioResult = await uploadAudioBlob(blob, user.id, sessionIdRef.current)

          const patchResponse = await fetch(`/api/sessions/${sessionIdRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio_url: audioResult.url,
              status: "pending",
              title: meetingTitle || generateDefaultTitle(),
              ...(meetingContext ? { context: meetingContext } : {}),
              ...(actualDuration ? { duration_seconds: Math.round(actualDuration) } : {}),
            }),
          })

          if (!patchResponse.ok) {
            const errorData = await patchResponse.json()
            throw new Error(errorData.error || "Failed to update session")
          }
        } else {
          audioResult = await combineAudioChunks(user.id, sessionIdRef.current, chunkCountRef.current)
          await deleteAudioChunks(user.id, sessionIdRef.current, chunkCountRef.current)

          const patchChunkResponse = await fetch(`/api/sessions/${sessionIdRef.current}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              audio_url: audioResult.url,
              status: "pending",
              title: meetingTitle || generateDefaultTitle(),
              ...(meetingContext ? { context: meetingContext } : {}),
              ...(actualDuration ? { duration_seconds: Math.round(actualDuration) } : {}),
            }),
          })

          if (!patchChunkResponse.ok) {
            const errorData = await patchChunkResponse.json()
            throw new Error(errorData.error || "Failed to update session")
          }
        }

        toast.success(isRTL ? "ההעלאה הושלמה" : "Upload complete")
        await startTranscription(sessionIdRef.current!)
        invalidateSessionsList()
        // Delay navigation to allow React Query cache to sync
        setTimeout(() => {
          router.push(`/meetings/${sessionIdRef.current}`)
        }, 500)
      } catch (error) {
        console.error("Failed to process recording:", error)
        toast.error(isRTL ? "העלאה נכשלה" : "Upload failed", {
          description: error instanceof Error ? error.message : "Unknown error",
          duration: 8000,
        })
      } finally {
        setIsProcessingRecording(false)
        chunkCountRef.current = 0
        sessionIdRef.current = null
        failedChunksRef.current.clear()
      }
    },
    [generateDefaultTitle, meetingContext, meetingLanguage, meetingTitle, router, isRTL, invalidateSessionsList],
  )

  const handleChunk = useCallback(
    async (chunk: Blob, index: number) => {
      const MAX_RETRIES = 3
      const RETRY_DELAY_MS = 1000

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const supabase = createClient()
          const {
            data: { user },
          } = await supabase.auth.getUser()

          if (!user) {
            toast.error(isRTL ? "נדרש להתחבר" : "Please sign in")
            return
          }

          if (index === 0 && !sessionIdRef.current) {
            const session = await createSession({
              title: meetingTitle || generateDefaultTitle(),
              detected_language: meetingLanguage,
            })
            sessionIdRef.current = session.id
          }

          if (sessionIdRef.current) {
            await uploadAudioChunk(chunk, user.id, sessionIdRef.current, index)
            chunkCountRef.current = index + 1
            failedChunksRef.current.delete(index)
            return
          }
        } catch (error) {
          console.error(`Chunk ${index} upload failed (attempt ${attempt}/${MAX_RETRIES}):`, error)

          if (attempt < MAX_RETRIES) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt))
            continue
          }

          failedChunksRef.current.add(index)
          if (failedChunksRef.current.size <= 3) {
            toast.error(isRTL ? "העלאה נכשלה" : "Upload failed", {
              description: isRTL
                ? `החלק ${index + 1} נכשל לאחר ${MAX_RETRIES} ניסיונות.`
                : `Chunk ${index + 1} failed after ${MAX_RETRIES} attempts.`,
              duration: 5000,
            })
          }
        }
      }
    },
    [generateDefaultTitle, meetingLanguage, meetingTitle, isRTL],
  )

  const {
    state: recordingState,
    duration: recordingDuration,
    error: recordingError,
    audioBlob: inPersonAudioBlob,
    stream: recordingStream,
    start: startInPersonRecording,
    stop: stopInPersonRecording,
    pause: pauseRecording,
    resume: resumeRecording,
  } = useRecording({
    mode: audioMode || "microphone",
    onChunk: handleChunk,
    onAutoEnd: handleAutoEnd,
    onError: (err) => {
      console.error("Recording error:", err)
      const isNoAudioError = err.message.includes("No audio captured") || err.message.includes("Share audio")
      toast.error(isRTL ? "שגיאה" : "Error", {
        description: err.message,
        duration: isNoAudioError ? 10000 : 5000,
      })
    },
  })

  const isInPersonRecording = recordingState === "recording"

  useEffect(() => {
    const MIN_VALID_BLOB_SIZE = 1000
    if (
      inPersonAudioBlob &&
      inPersonAudioBlob.size >= MIN_VALID_BLOB_SIZE &&
      recordingState === "stopped" &&
      !completedRef.current &&
      recordingMode !== null
    ) {
      completedRef.current = true
      void handleRecordingComplete(inPersonAudioBlob, false, recordingDuration)
    }
  }, [inPersonAudioBlob, recordingState, handleRecordingComplete, recordingMode, recordingDuration])

  const handleStartInPerson = useCallback(async () => {
    if (!meetingTitle.trim()) {
      setMeetingTitleError(true)
      return
    }
    if (!audioMode) return
    completedRef.current = false
    await startInPersonRecording()
  }, [audioMode, meetingTitle, startInPersonRecording])

  const handleStopInPerson = useCallback(() => {
    if (recordingDuration < 2) {
      toast.warning(isRTL ? "ההקלטה קצרה מדי" : "Please record at least a few seconds", { duration: 3000 })
      return
    }
    stopInPersonRecording()
  }, [stopInPersonRecording, recordingDuration, isRTL])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleTranscriptFileSelect = useCallback((file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase()
    if (!SUPPORTED_TRANSCRIPT_EXTENSIONS.includes(ext)) {
      toast.error(isRTL ? "פורמט לא נתמך" : "Unsupported format", {
        description: isRTL
          ? `פורמטים נתמכים: ${SUPPORTED_TRANSCRIPT_EXTENSIONS.join(", ")}`
          : `Supported: ${SUPPORTED_TRANSCRIPT_EXTENSIONS.join(", ")}`,
      })
      return
    }

    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      toast.error(isRTL ? "הקובץ גדול מדי" : "File too large", {
        description: isRTL ? "מקסימום 50MB" : "Max 50MB",
      })
      return
    }

    setTranscriptFile(file)
    setTranscriptError(null)
  }, [isRTL])

  const uploadTranscript = useCallback(
    async (file: File) => {
      if (!meetingTitle.trim()) {
        setMeetingTitleError(true)
        return
      }

      setTranscriptStatus("uploading")
      setTranscriptProgress(20)
      setTranscriptError(null)

      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("title", meetingTitle)
        if (meetingContext) {
          formData.append("context", meetingContext)
        }

        setTranscriptProgress(50)

        const response = await fetch("/api/sessions/import", {
          method: "POST",
          body: formData,
        })

        setTranscriptProgress(80)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage =
            errorData.error?.message ||
            (typeof errorData.error === "string" ? errorData.error : null) ||
            errorData.message ||
            `Import failed (${response.status})`
          throw new Error(errorMessage)
        }

        const data = await response.json()
        setTranscriptStatus("complete")
        setTranscriptProgress(100)

        toast.success(isRTL ? "התמליל נטען" : "Transcript imported")

        // Trigger AI enhancements in background (fire-and-forget)
        // Using keepalive to ensure requests complete even after navigation
        const sessionId = data.sessionId
        Promise.allSettled([
          fetch(`/api/sessions/${sessionId}/summarize`, {
            method: "POST",
            keepalive: true,
          }).catch(() => {}),
          fetch(`/api/sessions/${sessionId}/embeddings`, {
            method: "POST",
            keepalive: true,
          }).catch(() => {}),
          fetch(`/api/sessions/${sessionId}/entities`, {
            method: "POST",
            keepalive: true,
          }).catch(() => {}),
        ]).then((results) => {
          console.log("[import] AI enhancements triggered:", results.map(r => r.status))
        }).catch(() => {})

        invalidateSessionsList()
        setTimeout(() => {
          router.push(`/meetings/${data.sessionId}`)
        }, 500)
      } catch (err) {
        console.error("Import failed:", err)
        setTranscriptStatus("error")
        setTranscriptError(err instanceof Error ? err.message : "Unknown error")
        toast.error(isRTL ? "הייבוא נכשל" : "Import failed", {
          description: err instanceof Error ? err.message : undefined,
        })
      }
    },
    [meetingTitle, meetingContext, router, isRTL, invalidateSessionsList],
  )

  const handleTranscriptUpload = useCallback(() => {
    if (transcriptFile) {
      void uploadTranscript(transcriptFile)
    }
  }, [transcriptFile, uploadTranscript])

  const handlePasteUpload = useCallback(() => {
    if (!pastedTranscript.trim()) return
    const blob = new Blob([pastedTranscript], { type: "text/plain" })
    const filename = meetingTitle ? `${meetingTitle}.txt` : "pasted-transcript.txt"
    const file = new File([blob], filename, { type: "text/plain" })
    void uploadTranscript(file)
  }, [pastedTranscript, meetingTitle, uploadTranscript])

  const loadIntegrationEvents = useCallback(async (provider: IntegrationProvider) => {
    setIntegrationLoading(true)
    setIntegrationError(null)
    try {
      const now = new Date()
      const timeMin = now.toISOString()
      const timeMax = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString()
      const response = await fetch(`/api/integrations/${provider}/events?limit=50&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to fetch events")
      }

      const data = await response.json()
      setIntegrationEvents(data.events || [])
    } catch (error) {
      setIntegrationError(error instanceof Error ? error.message : "Failed to fetch events")
    } finally {
      setIntegrationLoading(false)
    }
  }, [])

  const handleConnectIntegration = useCallback(async (provider: IntegrationProvider) => {
    if (provider === "zoom" || provider === "teams") {
      return
    }

    setConnectingProvider(provider)
    try {
      const response = await fetch(`/api/integrations/${provider}/connect`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to connect")
      }
      const data = await response.json()
      if (data.authUrl) {
        window.location.href = data.authUrl
      }
    } catch (error) {
      toast.error(isRTL ? "חיבור נכשל" : "Connection failed", {
        description: error instanceof Error ? error.message : undefined,
      })
    } finally {
      setConnectingProvider(null)
    }
  }, [isRTL])

  const handleImportEvent = useCallback(async (event: CalendarEvent) => {
    try {
      const response = await fetch("/api/sessions/import/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: selectedIntegration,
          eventId: event.id,
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          timezone: event.timezone,
          meetingUrl: event.meetingUrl,
          attendees: event.attendees || [],
          platform: event.platform,
          organizerEmail: event.organizerEmail,
          raw: event.raw || {},
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to create draft")
      }

      const data = await response.json()
      toast.success(isRTL ? "טיוטה נוצרה" : "Draft created")
      invalidateSessionsList()
      router.push(`/meetings/${data.sessionId}`)
    } catch (error) {
      toast.error(isRTL ? "נכשל ליצור טיוטה" : "Failed to create draft", {
        description: error instanceof Error ? error.message : undefined,
      })
    }
  }, [selectedIntegration, router, isRTL, invalidateSessionsList])

  const displayEvents = useMemo(() => {
    if (integrationMode === "suggested") {
      return integrationEvents.filter((event) => Boolean(event.meetingUrl))
    }
    return integrationEvents
  }, [integrationEvents, integrationMode])

  const canProceed =
    uploadedFiles.some((file) => file.status === "processing" || file.status === "complete") ||
    recordingState === "recording" ||
    recordingState === "paused" ||
    transcriptStatus === "uploading" ||
    transcriptStatus === "complete"

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background overflow-auto" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto px-4 py-4 md:py-6 space-y-4">
        <Card className="overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg md:text-xl">{isRTL ? "פגישה חדשה" : "New Meeting"}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pb-4">
            <div className="space-y-1.5">
              <Label htmlFor="title" className="flex items-center gap-1 text-sm font-medium">
                {isRTL ? "שם הפגישה" : "Meeting Name"}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder={isRTL ? "חובה להזין שם לפני המשך" : "Required before proceeding"}
                value={meetingTitle}
                onChange={(e) => {
                  setMeetingTitle(e.target.value)
                  setMeetingTitleError(false)
                }}
                className={cn(
                  "h-11 md:h-12 text-base",
                  meetingTitleError && "border-red-500 focus-visible:ring-red-500",
                )}
              />
              {meetingTitleError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {isRTL ? "יש להזין שם לפגישה" : "Meeting name is required"}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="context" className="text-sm font-medium">
                {isRTL ? "הקשר לפגישה" : "Meeting context"}
              </Label>
              <Textarea
                id="context"
                placeholder={
                  isRTL
                    ? "הוסף הקשר לשיפור הדיוק"
                    : "Add context to improve accuracy"
                }
                value={meetingContext}
                onChange={(e) => setMeetingContext(e.target.value)}
                className="min-h-[90px]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-muted rounded-lg overflow-x-auto">
              <button
                onClick={() => setUploadType("audio")}
                className={cn(
                  "flex-1 min-w-0 flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap",
                  uploadType === "audio"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Upload className="w-4 h-4 shrink-0" />
                <span className="truncate">{isRTL ? "העלאת שמע" : "Upload Audio"}</span>
              </button>
              <button
                onClick={() => setUploadType("record")}
                className={cn(
                  "flex-1 min-w-0 flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap",
                  uploadType === "record"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Mic className="w-4 h-4 shrink-0" />
                <span className="truncate">{isRTL ? "הקלטה" : "Record"}</span>
              </button>
              <button
                onClick={() => setUploadType("transcript")}
                className={cn(
                  "flex-1 min-w-0 flex items-center justify-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 rounded-md text-xs md:text-sm font-medium transition-all whitespace-nowrap",
                  uploadType === "transcript"
                    ? "bg-white shadow-sm text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span className="truncate">{isRTL ? "תמליל" : "Transcript"}</span>
              </button>
            </div>

            {uploadType === "audio" && (
              <div
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-4 transition-all cursor-pointer",
                  isDragging ? "border-teal-500 bg-teal-50" : "border-border hover:border-teal-300",
                )}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  if (e.dataTransfer.files.length) {
                    handleFileUpload(e.dataTransfer.files)
                  }
                }}
                onClick={() => document.getElementById("file-upload")?.click()}
              >
                <input
                  type="file"
                  multiple
                  accept="audio/*,video/*"
                  className="sr-only"
                  id="file-upload"
                  onChange={(e) => {
                    handleFileUpload(e.target.files)
                    e.target.value = ""
                  }}
                />
                <div className="text-center space-y-2 pointer-events-none">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">
                    {isRTL ? "גרור קבצי שמע/וידאו לכאן" : "Drag audio/video files here"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? "או לחץ כדי לבחור קבצים" : "Or click to select files"}
                  </p>
                </div>
              </div>
            )}

            {uploadType === "audio" && uploadedFiles.length > 0 && (
              <div className="space-y-2">
                {uploadedFiles.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-2 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(file.status)}
                      <div>
                        <p className="text-sm font-medium truncate max-w-[220px] md:max-w-[320px]">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{file.size}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {file.status === "uploading" || file.status === "processing" ? (
                        <div className="w-24">
                          <Progress value={file.progress} className="h-2" />
                        </div>
                      ) : null}
                      {file.status === "error" ? (
                        <span className="text-xs text-red-500">{file.error || "Error"}</span>
                      ) : null}
                      <button onClick={() => removeFile(file.id)} className="text-muted-foreground hover:text-foreground">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {uploadType === "transcript" && (
              <div className="space-y-4">
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-4 transition-all",
                    isDragging ? "border-amber-500 bg-amber-50" : "border-border hover:border-amber-300",
                    transcriptStatus === "error" && "border-red-300 bg-red-50/50",
                  )}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDragging(false)
                    if (e.dataTransfer.files.length) {
                      handleTranscriptFileSelect(e.dataTransfer.files[0])
                    }
                  }}
                >
                  <input
                    type="file"
                    accept={SUPPORTED_TRANSCRIPT_EXTENSIONS.join(",")}
                    className="hidden"
                    id="transcript-upload"
                    onChange={(e) => {
                      if (e.target.files?.length) {
                        handleTranscriptFileSelect(e.target.files[0])
                      }
                    }}
                  />
                  <label htmlFor="transcript-upload" className="cursor-pointer block">
                    <div className="text-center space-y-2">
                      <FileText className="w-8 h-8 mx-auto text-muted-foreground" />
                      <p className="text-sm font-medium">
                        {isRTL ? "העלה קובץ תמליל" : "Upload transcript file"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {SUPPORTED_TRANSCRIPT_EXTENSIONS.join(", ")}
                      </p>
                    </div>
                  </label>
                </div>

                {transcriptFile && (
                  <div className="flex items-center justify-between p-2 rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(transcriptStatus)}
                      <div>
                        <p className="text-sm font-medium truncate max-w-[220px] md:max-w-[320px]">{transcriptFile.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {(transcriptFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {transcriptStatus === "uploading" ? (
                        <div className="w-24">
                          <Progress value={transcriptProgress} className="h-2" />
                        </div>
                      ) : null}
                      {transcriptStatus === "error" ? (
                        <span className="text-xs text-red-500">{transcriptError}</span>
                      ) : null}
                      <button
                        onClick={() => {
                          setTranscriptFile(null)
                          setTranscriptStatus("idle")
                          setTranscriptProgress(0)
                          setTranscriptError(null)
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleTranscriptUpload}
                  disabled={!transcriptFile || transcriptStatus === "uploading"}
                >
                  {transcriptStatus === "uploading" ? (
                    <Loader2 className={cn("w-4 h-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
                  ) : null}
                  {isRTL ? "ייבא תמליל" : "Import transcript"}
                </Button>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">{isRTL ? "או הדבק תמליל" : "Or paste transcript"}</Label>
                  <Textarea
                    placeholder={isRTL ? "הדבק כאן..." : "Paste here..."}
                    value={pastedTranscript}
                    onChange={(e) => setPastedTranscript(e.target.value)}
                    className="min-h-[140px]"
                  />
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handlePasteUpload}
                    disabled={!pastedTranscript.trim() || transcriptStatus === "uploading"}
                  >
                    {isRTL ? "ייבא טקסט" : "Import text"}
                  </Button>
                </div>
              </div>
            )}

            {uploadType === "record" && (
              <div className="space-y-4">
                {!recordingMode ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{isRTL ? "בחר את סוג ההקלטה" : "Select recording type"}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <button
                        onClick={() => {
                          setRecordingMode("in-person")
                          setAudioMode("microphone")
                        }}
                        className="p-4 border rounded-xl hover:border-teal-400 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Mic className="w-5 h-5 text-teal-600" />
                          <div>
                            <p className="text-sm font-medium">{isRTL ? "הקלטה מהמיקרופון" : "Mic recording"}</p>
                            <p className="text-xs text-muted-foreground">
                              {isRTL ? "פגישה פיזית" : "In-person meeting"}
                            </p>
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setRecordingMode("online")
                          setAudioMode("system")
                        }}
                        className="p-4 border rounded-xl hover:border-teal-400 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <Monitor className="w-5 h-5 text-teal-600" />
                          <div>
                            <p className="text-sm font-medium">{isRTL ? "שיתוף מסך + שמע" : "Screen + audio"}</p>
                            <p className="text-xs text-muted-foreground">
                              {isRTL ? "פגישה מקוונת" : "Online meeting"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {isRTL
                                ? "בחר את הטאב של הפגישה וודא שסימנת Share audio"
                                : "Select the meeting tab and ensure Share audio is checked"}
                            </p>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="border rounded-xl p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setRecordingMode(null)
                          setAudioMode(null)
                        }}
                      >
                        <ArrowLeft className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                        {isRTL ? "חזרה" : "Back"}
                      </Button>
                      <span className="text-xs text-muted-foreground">
                        {recordingMode === "online"
                          ? isRTL
                            ? "ודא ש-Share audio מסומן"
                            : "Ensure Share audio is checked"
                          : isRTL
                            ? "מקליט מהמיקרופון"
                            : "Recording from microphone"}
                      </span>
                    </div>

                    <div className="rounded-lg border p-3">
                      {recordingState === "recording" ? (
                        <Waveform stream={recordingStream} />
                      ) : (
                        <IdleWaveform />
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">{isRTL ? "משך" : "Duration"}</p>
                        <p className="text-xl font-mono font-semibold" dir="ltr">{formatTime(recordingDuration)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {recordingState === "recording" ? (
                          <Button variant="outline" onClick={pauseRecording}>
                            {isRTL ? "השהה" : "Pause"}
                          </Button>
                        ) : null}
                        {recordingState === "paused" ? (
                          <Button variant="outline" onClick={resumeRecording}>
                            {isRTL ? "המשך" : "Resume"}
                          </Button>
                        ) : null}
                        {!isInPersonRecording && recordingState !== "paused" ? (
                          <Button onClick={handleStartInPerson}>
                            <Mic className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                            {isRTL ? "התחל הקלטה" : "Start"}
                          </Button>
                        ) : (
                          <Button variant="destructive" onClick={handleStopInPerson}>
                            <Square className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                            {isRTL ? "עצור" : "Stop"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {recordingError && (
                      <div className="text-sm text-red-500 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        {recordingError.message}
                      </div>
                    )}

                    {isProcessingRecording && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {isRTL ? "מעבד הקלטה" : "Processing recording"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>

          <CardFooter className="flex flex-col gap-2 border-t bg-muted/30">
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <InfoBadge />
              <span>{isRTL ? "אין אוטומציה נסתרת. אתה שולט בתהליך." : "No hidden automation. You stay in control."}</span>
            </div>
            {canProceed ? (
              <p className="text-xs text-muted-foreground">
                {isRTL ? "תהליך העיבוד יתחיל לאחר העלאה" : "Processing begins after upload."}
              </p>
            ) : null}
          </CardFooter>
        </Card>

        {SHOW_CALENDAR_IMPORT && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {isRTL ? "ייבוא מהיומן" : "Import from calendar"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedIntegration ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(["google", "outlook", "zoom", "teams"] as IntegrationProvider[]).map((provider) => (
                  <button
                    key={provider}
                    onClick={() => setSelectedIntegration(provider)}
                    className={cn(
                      "p-4 border rounded-xl text-left transition",
                      provider === "zoom" || provider === "teams" ? "opacity-60 cursor-not-allowed" : "hover:border-teal-400",
                    )}
                    disabled={provider === "zoom" || provider === "teams"}
                  >
                    <p className="text-sm font-medium capitalize">{provider.replace("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">
                      {provider === "google"
                        ? isRTL
                          ? "התחבר ל-Google Calendar"
                          : "Connect Google Calendar"
                        : provider === "outlook"
                          ? isRTL
                            ? "התחבר ל-Outlook"
                            : "Connect Outlook"
                          : isRTL
                            ? "דורש חיבור נוסף"
                            : "Requires backend setup"}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium capitalize">{selectedIntegration.replace("_", " ")}</p>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIntegration(null)}>
                    {isRTL ? "בחירה אחרת" : "Change"}
                  </Button>
                </div>

                <div className="rounded-xl border p-4 space-y-2">
                  <p className="text-sm font-medium">
                    {isRTL ? integrationCopy[selectedIntegration].titleHe : integrationCopy[selectedIntegration].titleEn}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? integrationCopy[selectedIntegration].descHe : integrationCopy[selectedIntegration].descEn}
                  </p>
                  <Button
                    className="w-full"
                    onClick={() => handleConnectIntegration(selectedIntegration)}
                    disabled={selectedIntegration === "zoom" || selectedIntegration === "teams" || connectingProvider === selectedIntegration}
                  >
                    {connectingProvider === selectedIntegration ? (
                      <Loader2 className={cn("w-4 h-4 animate-spin", isRTL ? "ml-2" : "mr-2")} />
                    ) : null}
                    {isRTL ? integrationCopy[selectedIntegration].actionHe : integrationCopy[selectedIntegration].actionEn}
                  </Button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {isRTL ? "לאחר החיבור תוכל לבחור פגישות לייבוא" : "After connecting, pick meetings to import."}
                  </p>

                  <div className="flex items-center gap-2">
                    {(["manual", "suggested", "auto"] as IntegrationMode[]).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => setIntegrationMode(mode)}
                        className={cn(
                          "px-3 py-1.5 text-xs rounded-full border",
                          integrationMode === mode ? "bg-teal-600 text-white border-teal-600" : "text-muted-foreground",
                        )}
                      >
                        {mode === "manual"
                          ? isRTL
                            ? "ייבוא ידני"
                            : "Manual import"
                          : mode === "suggested"
                            ? isRTL
                              ? "פגישות מוצעות"
                              : "Suggested meetings"
                            : isRTL
                              ? "ייבוא אוטומטי (בטא)"
                              : "Auto-import (beta)"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{isRTL ? "פגישות מהיומן" : "Calendar meetings"}</p>
                    <Button variant="ghost" size="sm" onClick={() => selectedIntegration && loadIntegrationEvents(selectedIntegration)}>
                      {isRTL ? "רענן" : "Refresh"}
                    </Button>
                  </div>

                  {integrationLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {isRTL ? "טוען פגישות" : "Loading meetings"}
                    </div>
                  ) : null}

                  {integrationError ? (
                    <div className="text-sm text-red-500 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      {integrationError}
                    </div>
                  ) : null}

                  {!integrationLoading && displayEvents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {isRTL ? "לא נמצאו פגישות" : "No meetings found"}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {displayEvents.map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-2 rounded-lg border">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{event.title}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(event.startTime).toLocaleString(isRTL ? "he-IL" : "en-US", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </span>
                              {event.attendees?.length ? (
                                <span className="inline-flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  {event.attendees.length}
                                </span>
                              ) : null}
                              {event.platform && event.platform !== "unknown" ? (
                                <span className="inline-flex items-center gap-1">
                                  <Monitor className="w-3 h-3" />
                                  {event.platform.replace("_", " ")}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          <Button size="sm" onClick={() => handleImportEvent(event)}>
                            {isRTL ? "צור טיוטה" : "Create draft"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </div>

      <AlertDialog open={showShortMeetingDialog} onOpenChange={setShowShortMeetingDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRTL ? "הקלטה קצרה" : "Short Recording"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRTL
                ? `הקלטה זו קצרה מדקה (${Math.round(shortMeetingDuration)} שניות). המשך בכל זאת?`
                : `This recording is less than a minute (${Math.round(shortMeetingDuration)} seconds). Continue anyway?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRTL ? "ביטול" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingShortMeetingAction) {
                  void pendingShortMeetingAction()
                }
                setShowShortMeetingDialog(false)
              }}
            >
              {isRTL ? "המשך" : "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InfoBadge() {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-semibold">
      i
    </span>
  )
}
