"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations, useLocale } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Upload,
  Mic,
  FileAudio,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  Info,
  Monitor,
  Users,
  Square,
  Pause,
  Play,
} from "lucide-react"
import { toast } from "sonner"
import { useRecording, type RecordingMode as AudioMode, type AutoEndReason } from "@/hooks/use-recording"
import { Waveform } from "@/components/recording/waveform"
import { IdleWaveform } from "@/components/recording/idle-waveform"
import { uploadAudioBlob, uploadAudioChunk, combineAudioChunks, deleteAudioChunks, validateAudioForSpeech, formatValidationDetails } from "@/lib/audio"
import { createSession, startTranscription } from "@/hooks/use-session"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

type UploadStatus = "idle" | "uploading" | "processing" | "complete" | "error"
type RecordingMode = "in-person" | "online" | null

interface UploadedFile {
  id: string
  name: string
  size: string
  status: UploadStatus
  progress: number
  sessionId?: string
  error?: string
}

export default function NewMeetingPage() {
  const t = useTranslations()
  const locale = useLocale()
  const isRTL = locale === "he"
  const router = useRouter()
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingTitleError, setMeetingTitleError] = useState(false)
  const [showTitleRequired, setShowTitleRequired] = useState(false)
  const [meetingContext, setMeetingContext] = useState("")
  const [meetingLanguage, setMeetingLanguage] = useState<"he" | "en">("he")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessingRecording, setIsProcessingRecording] = useState(false)
  const [recordingMode, setRecordingMode] = useState<RecordingMode>(null)
  const [audioMode, setAudioMode] = useState<AudioMode | null>(null)

  useEffect(() => {
    setMeetingLanguage(locale === "he" ? "he" : "en")
  }, [locale])

  // Generate default title with date and time
  const generateDefaultTitle = useCallback(() => {
    const now = new Date()
    const dateStr = now.toLocaleDateString(locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
    const timeStr = now.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    })
    return isRTL ? `הקלטה ${dateStr} ${timeStr}` : `Recording ${dateStr} ${timeStr}`
  }, [locale, isRTL])

  // Handle auto-end from recording hook
  const handleAutoEnd = useCallback((reason: AutoEndReason) => {
    if (reason === "pause_timeout") {
      toast.warning(isRTL ? "ההקלטה הסתיימה אוטומטית עקב השהייה ממושכת" : "Recording ended automatically due to extended pause", {
        duration: 8000,
      })
    } else if (reason === "page_exit") {
      toast.info(isRTL ? "ההקלטה נשמרה" : "Recording saved", {
        duration: 5000,
      })
    }
  }, [isRTL])

  // Track chunks during recording
  const chunkCountRef = useRef(0)
  const sessionIdRef = useRef<string | null>(null)
  const completedRef = useRef(false)

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

  const getStatusText = (status: UploadStatus): string => {
    switch (status) {
      case "uploading":
        return t("upload.uploading")
      case "processing":
        return t("upload.processing")
      case "complete":
        return t("upload.success")
      case "error":
        return t("upload.failed")
      default:
        return ""
    }
  }

  const updateFileStatus = useCallback((fileId: string, updates: Partial<UploadedFile>) => {
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f))
    )
  }, [])

  const processFile = useCallback(async (file: File, fileId: string) => {
    try {
      // Get current user
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        updateFileStatus(fileId, { status: "error", error: t("auth.signIn") })
        return
      }

      // Validate audio for speech content
      updateFileStatus(fileId, { status: "uploading", progress: 10 })
      const validation = await validateAudioForSpeech(file)

      if (!validation.isValid) {
        console.log("Validation details:", formatValidationDetails(validation.details))
        updateFileStatus(fileId, { status: "error", error: validation.error })
        return
      }

      updateFileStatus(fileId, { progress: 30 })

      // Create session with title, context and language
      const session = await createSession({
        title: meetingTitle || file.name.replace(/\.[^/.]+$/, ""),
        context: meetingContext || undefined,
        detected_language: meetingLanguage,
      })

      updateFileStatus(fileId, { progress: 50, sessionId: session.id })

      // Upload file
      const audioResult = await uploadAudioBlob(file, user.id, session.id, file.name)

      // Update session with audio URL
      await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: audioResult.url }),
      })

      updateFileStatus(fileId, { status: "processing", progress: 70 })

      // Start transcription
      await startTranscription(session.id)

      updateFileStatus(fileId, { status: "complete", progress: 100 })
    } catch (error) {
      console.error("Upload failed:", error)
      updateFileStatus(fileId, {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }, [meetingTitle, meetingContext, meetingLanguage, t, updateFileStatus])

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return
    if (!meetingTitle.trim()) {
      setMeetingTitleError(true)
      setShowTitleRequired(true)
      return
    }

    Array.from(files).forEach((file) => {
      // Validate file type
      if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
        toast.error(t("upload.invalidType"), {
          description: t("upload.selectAudioFile"),
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
      processFile(file, fileId)
    })
  }, [meetingTitle, processFile, t])

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  // Track failed chunks for recovery
  const failedChunksRef = useRef<Set<number>>(new Set())

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    setIsProcessingRecording(true)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error(t("auth.signIn"))
        setIsProcessingRecording(false)
        return
      }

      // Validate audio for speech content
      toast.info(t("upload.validating"))
      const validation = await validateAudioForSpeech(blob)

      if (!validation.isValid) {
        toast.error(t("upload.validationFailed"), {
          description: validation.error,
          duration: 8000,
        })
        console.log("Validation details:", formatValidationDetails(validation.details))
        setIsProcessingRecording(false)
        // Reset failed chunks tracking
        failedChunksRef.current.clear()
        return
      }

      toast.info(t("upload.processing"))

      let audioResult
      const hasFailedChunks = failedChunksRef.current.size > 0

      // If we have chunks uploaded and some failed, fall back to uploading the full blob
      if (hasFailedChunks && chunkCountRef.current > 0) {
        toast.warning("Some chunks failed to upload. Uploading full recording...", {
          duration: 5000,
        })
        // Clean up partial chunks
        if (sessionIdRef.current) {
          try {
            await deleteAudioChunks(user.id, sessionIdRef.current, chunkCountRef.current)
          } catch (cleanupError) {
            console.error("Failed to clean up chunks:", cleanupError)
          }
        }
        // Fall through to upload the full blob instead
      }

      // Use full blob upload if: no chunks, failed chunks, or chunk count is 0
      if (chunkCountRef.current === 0 || hasFailedChunks || !sessionIdRef.current) {
        // Create a new session if needed
        if (!sessionIdRef.current) {
          const session = await createSession({
            title: meetingTitle || generateDefaultTitle(),
            context: meetingContext || undefined,
            detected_language: meetingLanguage,
          })
          sessionIdRef.current = session.id
        }

        audioResult = await uploadAudioBlob(blob, user.id, sessionIdRef.current)

        await fetch(`/api/sessions/${sessionIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio_url: audioResult.url,
            title: meetingTitle || generateDefaultTitle(),
            ...(meetingContext ? { context: meetingContext } : {}),
          }),
        })
      } else {
        // Combine chunks (all uploaded successfully)
        audioResult = await combineAudioChunks(user.id, sessionIdRef.current, chunkCountRef.current)
        await deleteAudioChunks(user.id, sessionIdRef.current, chunkCountRef.current)

        // Update session with audio URL and context
        await fetch(`/api/sessions/${sessionIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio_url: audioResult.url,
            title: meetingTitle || generateDefaultTitle(),
            ...(meetingContext ? { context: meetingContext } : {}),
          }),
        })
      }

      toast.success(t("upload.success"))
      await startTranscription(sessionIdRef.current!)
      router.push(`/meetings/${sessionIdRef.current}`)
    } catch (error) {
      console.error("Failed to process recording:", error)
      toast.error(t("upload.failed"), {
        description: error instanceof Error ? error.message : "Unknown error",
        duration: 8000,
      })
    } finally {
      setIsProcessingRecording(false)
      chunkCountRef.current = 0
      sessionIdRef.current = null
      failedChunksRef.current.clear()
    }
  }, [router, t, meetingTitle, meetingContext, meetingLanguage])

  const handleChunk = useCallback(async (chunk: Blob, index: number) => {
    const MAX_RETRIES = 3
    const RETRY_DELAY_MS = 1000 // Start with 1 second, double on each retry

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          toast.error(t("auth.signIn"))
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
          // Remove from failed chunks if it was retried successfully
          failedChunksRef.current.delete(index)
          return // Success!
        }
      } catch (error) {
        console.error(`Chunk ${index} upload failed (attempt ${attempt}/${MAX_RETRIES}):`, error)

        if (attempt < MAX_RETRIES) {
          // Wait before retrying with exponential backoff
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS * attempt))
          continue
        }

        // Final failure after all retries - add to failed chunks
        failedChunksRef.current.add(index)

        // Only show toast for first few failures to avoid spam
        if (failedChunksRef.current.size <= 3) {
          toast.error(t("upload.failed"), {
            description: `Chunk ${index + 1} upload failed after ${MAX_RETRIES} attempts.`,
            duration: 5000,
          })
        }
      }
    }
  }, [meetingTitle, meetingLanguage, t])

  // Recording hook for in-person mode
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
      // Show user-friendly error message
      const isNoAudioError = err.message.includes("No audio captured") || err.message.includes("Share audio")
      toast.error(isNoAudioError ? t("common.important") : t("common.error"), {
        description: err.message,
        duration: isNoAudioError ? 10000 : 5000,
      })
    },
  })

  const isInPersonIdle = recordingState === "idle" || recordingState === "stopped"
  const isInPersonRecording = recordingState === "recording"

  // Handle in-person recording completion
  useEffect(() => {
    const MIN_VALID_BLOB_SIZE = 1000
    if (inPersonAudioBlob && inPersonAudioBlob.size >= MIN_VALID_BLOB_SIZE &&
        recordingState === "stopped" && !completedRef.current && recordingMode !== null) {
      completedRef.current = true
      handleRecordingComplete(inPersonAudioBlob)
    }
  }, [inPersonAudioBlob, recordingState, handleRecordingComplete, recordingMode])

  const handleStartInPerson = useCallback(async () => {
    if (!meetingTitle.trim()) {
      setMeetingTitleError(true)
      setShowTitleRequired(true)
      return
    }
    if (!audioMode) return
    completedRef.current = false
    await startInPersonRecording()
  }, [audioMode, meetingTitle, startInPersonRecording])

  const handleStopInPerson = useCallback(() => {
    if (recordingDuration < 2) {
      toast.warning(t("recording.tooShort") || "Please record at least a few seconds", {
        duration: 3000,
      })
      return
    }
    stopInPersonRecording()
  }, [stopInPersonRecording, recordingDuration, t])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const hasCompletedFiles = uploadedFiles.some((file) => file.status === "complete")
  const hasFilesOrRecording = uploadedFiles.length > 0

  const handleProceedToMeeting = () => {
    const sessionId = uploadedFiles.find((file) => file.status === "complete" && file.sessionId)?.sessionId
    if (sessionId) {
      router.push(`/meetings/${sessionId}`)
    }
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] bg-background overflow-hidden" dir={isRTL ? "rtl" : "ltr"}>
      <div className="h-full max-w-3xl mx-auto px-4 py-6 flex flex-col">
        <div className="mb-4 flex-shrink-0">
          <h1 className="text-2xl font-bold text-foreground mb-1">{t("nav.newMeeting")}</h1>
          <p className="text-muted-foreground text-sm">{t("upload.pageDescription")}</p>
        </div>

        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardContent className="p-4 flex flex-col h-full gap-4 min-h-0">
            <div className="flex-shrink-0 space-y-1.5">
              <Label htmlFor="title" className="flex items-center gap-1 text-sm font-medium">
                {isRTL ? "כותרת הפגישה" : "Meeting Title"}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder={isRTL ? "לדוגמה: פגישת צוות שבועית" : "e.g., Weekly team meeting"}
                value={meetingTitle}
                onChange={(e) => {
                  setMeetingTitle(e.target.value)
                  setMeetingTitleError(false)
                  setShowTitleRequired(false)
                }}
                className={cn("h-10", meetingTitleError && "border-red-500 focus-visible:ring-red-500")}
              />
              {showTitleRequired && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {isRTL ? "יש להזין כותרת לפני המשך" : "Please enter a title before proceeding"}
                </p>
              )}
            </div>

            <Tabs defaultValue="upload" className="flex-1 flex flex-col min-h-0">
              <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0 flex-shrink-0">
                <TabsTrigger
                  value="upload"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent py-2.5"
                >
                  <Upload className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} aria-hidden="true" />
                  {isRTL ? "העלאת הקלטה" : "Upload Recording"}
                </TabsTrigger>
                <TabsTrigger
                  value="record"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent py-2.5"
                >
                  <Mic className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} aria-hidden="true" />
                  {isRTL ? "הקלטה חיה" : "Live Recording"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="m-0 flex-1 flex flex-col pt-4 min-h-0 overflow-y-auto">
                <div
                  className={cn(
                    "flex-1 border-2 border-dashed rounded-xl p-4 transition-all flex flex-col",
                    isDragging ? "border-teal-500 bg-teal-50" : "border-border hover:border-teal-300"
                  )}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setIsDragging(true)
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setIsDragging(false)
                    handleFileUpload(e.dataTransfer.files)
                  }}
                >
                  {uploadedFiles.length > 0 ? (
                    <div className="flex-1 flex flex-col">
                      <div className="flex-1 space-y-2 overflow-y-auto">
                        {uploadedFiles.map((file) => (
                          <div
                            key={file.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg",
                              file.status === "error" ? "bg-red-50" : "bg-muted/50"
                            )}
                          >
                            {getStatusIcon(file.status)}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium truncate">{file.name}</p>
                                <span className="text-xs text-muted-foreground">{file.size}</span>
                              </div>
                              {["uploading", "processing"].includes(file.status) && (
                                <div className="space-y-1">
                                  <Progress value={file.progress} className="h-1.5" />
                                  <p className="text-xs text-muted-foreground">{getStatusText(file.status)}</p>
                                </div>
                              )}
                              {file.status === "complete" && (
                                <p className="text-xs text-green-600">{getStatusText(file.status)}</p>
                              )}
                              {file.status === "error" && (
                                <p className="text-xs text-red-600">{file.error || getStatusText(file.status)}</p>
                              )}
                            </div>
                            {file.status !== "complete" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => removeFile(file.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="mt-3">
                        <label>
                          <input
                            type="file"
                            accept="audio/*,video/*"
                            multiple
                            className="hidden"
                            onChange={(e) => handleFileUpload(e.target.files)}
                          />
                          <Button variant="outline" size="sm" className="cursor-pointer bg-transparent" asChild>
                            <span>{isRTL ? "הוסף קובץ נוסף" : "Add another file"}</span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-3">
                        <Upload className="w-6 h-6 text-teal-600" aria-hidden="true" />
                      </div>
                      <h3 className="text-base font-medium mb-1">{isRTL ? "גרור קבצים לכאן" : "Drag files here"}</h3>
                      <p className="text-muted-foreground mb-3 text-sm">{isRTL ? "או" : "or"}</p>
                      <label>
                        <input
                          type="file"
                          accept="audio/*,video/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleFileUpload(e.target.files)}
                        />
                        <Button variant="outline" className="cursor-pointer bg-transparent" asChild>
                          <span>{isRTL ? "בחר קובץ" : "Select File"}</span>
                        </Button>
                      </label>
                      <p className="text-xs text-muted-foreground mt-3">
                        {isRTL ? "MP3, WAV, M4A, MP4, WebM עד 500MB" : "MP3, WAV, M4A, MP4, WebM up to 500MB"}
                      </p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="record" className="m-0 flex-1 flex flex-col pt-4 min-h-0 overflow-y-auto">
                <div className="flex-1 flex flex-col items-center justify-center py-2">
                  {isProcessingRecording ? (
                    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center py-12 gap-4">
                      <Loader2 className="h-12 w-12 animate-spin text-teal-600" aria-hidden="true" />
                      <p className="font-medium">{t("upload.processing")}</p>
                    </div>
                  ) : !recordingMode ? (
                    <div className="w-full max-w-sm space-y-4">
                      <p className="text-center text-muted-foreground text-sm">
                        {isRTL ? "בחר את סוג ההקלטה" : "Select recording type"}
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => {
                            setRecordingMode("in-person")
                            setAudioMode("microphone")
                          }}
                          className="p-4 border-2 border-border rounded-xl hover:border-teal-300 hover:bg-teal-50/50 transition-all text-center group"
                        >
                          <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-teal-200 transition-colors">
                            <Users className="w-5 h-5 text-teal-600" />
                          </div>
                          <h3 className="font-medium text-sm mb-1">{isRTL ? "פגישה פיזית" : "In-Person"}</h3>
                          <p className="text-xs text-muted-foreground">
                            {isRTL ? "הקלטה מהמיקרופון" : "Mic recording"}
                          </p>
                        </button>
                        <button
                          onClick={() => {
                            setRecordingMode("online")
                            setAudioMode("system")
                          }}
                          className="p-4 border-2 border-border rounded-xl hover:border-blue-300 hover:bg-blue-50/50 transition-all text-center group"
                        >
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-200 transition-colors">
                            <Monitor className="w-5 h-5 text-blue-600" />
                          </div>
                          <h3 className="font-medium text-sm mb-1">{isRTL ? "פגישה מקוונת" : "Online"}</h3>
                          <p className="text-xs text-muted-foreground">Zoom, Teams, Meet</p>
                        </button>
                      </div>
                    </div>
                  ) : recordingState === "recording" || recordingState === "paused" ? (
                    <div className="text-center">
                      {/* Waveform - show idle wave when paused, live wave when recording */}
                      <div className="w-full max-w-xs mx-auto mb-4 h-20 relative">
                        {recordingState === "paused" ? (
                          <IdleWaveform className="h-full" />
                        ) : (
                          <Waveform
                            stream={recordingStream}
                            className="h-full"
                            barColor="#ef4444"
                            backgroundColor="#1f2937"
                          />
                        )}
                        {/* Status indicator in corner */}
                        <div className="absolute top-2 start-2 flex items-center gap-1.5">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            recordingState === "paused" ? "bg-yellow-500" : "bg-red-500 animate-pulse"
                          )} />
                          <span className="text-xs text-white/70">
                            {recordingState === "paused"
                              ? (isRTL ? "מושהה" : "PAUSED")
                              : (isRTL ? "מקליט" : "REC")}
                          </span>
                        </div>
                      </div>
                      <p className="text-3xl font-mono font-bold mb-2">{formatTime(recordingDuration)}</p>
                      <p className="text-muted-foreground mb-4">
                        {recordingState === "paused"
                          ? (isRTL ? "הקלטה מושהית" : "Recording paused")
                          : (isRTL ? "מקליט..." : "Recording...")}
                      </p>

                      {/* Pause timeout warning when paused */}
                      {recordingState === "paused" && (
                        <p className="text-xs text-yellow-600 mb-4">
                          {isRTL
                            ? "ההקלטה תסתיים אוטומטית אם לא תמשיך תוך שעה"
                            : "Recording will end automatically if not resumed within an hour"}
                        </p>
                      )}

                      {/* Control buttons */}
                      <div className="flex justify-center gap-3">
                        {recordingState === "recording" ? (
                          <Button onClick={pauseRecording} variant="outline">
                            <Pause className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                            {isRTL ? "השהה" : "Pause"}
                          </Button>
                        ) : (
                          <Button onClick={resumeRecording} variant="outline" className="border-yellow-500 text-yellow-600 hover:bg-yellow-50">
                            <Play className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                            {isRTL ? "המשך" : "Resume"}
                          </Button>
                        )}
                        <Button onClick={handleStopInPerson} variant="destructive">
                          <Square className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                          {isRTL ? "סיים הקלטה" : "Stop Recording"}
                        </Button>
                      </div>
                    </div>
                  ) : recordingMode === "online" ? (
                    <div className="text-center max-w-sm">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Monitor className="w-5 h-5 text-blue-600" />
                      </div>
                      <h3 className="font-semibold mb-3">
                        {isRTL ? "הקלטת פגישה מקוונת" : "Online Meeting Recording"}
                      </h3>
                      <div className="bg-blue-50 rounded-lg px-3 py-2 mb-4 text-right" dir="rtl">
                        <p className="text-xs text-blue-700">
                          {isRTL
                            ? "בחרו חלון, וסמנו ״שתף שמע״ לפני התחלה."
                            : "Pick a window and enable “Share audio” before starting."}
                        </p>
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button onClick={handleStartInPerson} className="bg-blue-600 hover:bg-blue-700">
                          <Mic className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                          {isRTL ? "התחל הקלטה" : "Start Recording"}
                        </Button>
                        <Button variant="outline" onClick={() => { setRecordingMode(null); setAudioMode(null) }}>
                          {isRTL ? "חזור" : "Back"}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Users className="w-5 h-5 text-teal-600" />
                      </div>
                      <h3 className="font-semibold mb-2">
                        {isRTL ? "הקלטת פגישה פיזית" : "In-Person Meeting Recording"}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-4">
                        {isRTL ? "הקלטה ישירה מהמיקרופון של המחשב" : "Direct recording from your computer microphone"}
                      </p>
                      {recordingError && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 mb-4">
                          {recordingError.message}
                        </div>
                      )}
                      <div className="flex gap-2 justify-center">
                        <Button onClick={handleStartInPerson} className="bg-teal-600 hover:bg-teal-700">
                          <Mic className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                          {isRTL ? "התחל הקלטה" : "Start Recording"}
                        </Button>
                        <Button variant="outline" onClick={() => { setRecordingMode(null); setAudioMode(null) }}>
                          {isRTL ? "חזור" : "Back"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="flex-shrink-0 space-y-3 pt-2 border-t border-border">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="context" className="text-sm">
                    {isRTL ? "הקשר לפגישה" : "Meeting Context"}
                  </Label>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="w-3 h-3" aria-hidden="true" />
                    {isRTL ? "משפר דיוק" : "Improves accuracy"}
                  </span>
                </div>
                <Textarea
                  id="context"
                  placeholder={
                    isRTL
                      ? "פגישה בין בן ומאיה על יוזמת שיווק חדשה בגרמניה. אני מציג גישת גרילה מרקטינג ל-CMO."
                      : "Meeting between Ben and Maya about a new marketing initiative in Germany. I'm presenting a guerilla marketing approach to the CMO."
                  }
                  value={meetingContext}
                  onChange={(e) => setMeetingContext(e.target.value)}
                  rows={2}
                  className="resize-none text-sm"
                />
              </div>

              {hasFilesOrRecording && (
                <Button
                  onClick={handleProceedToMeeting}
                  className="w-full bg-teal-600 hover:bg-teal-700"
                  disabled={!hasCompletedFiles}
                >
                  {isRTL ? "המשך לפגישה" : "Continue to Meeting"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
