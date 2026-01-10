"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import Link from "next/link"
import { toast } from "sonner"
import { Recorder, ModeSelector, IdleWaveform, RecordingTimer, Waveform } from "@/components/recording"
import { useRecording, type RecordingMode as AudioMode } from "@/hooks/use-recording"
import { uploadAudioBlob, uploadAudioChunk, combineAudioChunks, deleteAudioChunks, validateAudioForSpeech, formatValidationDetails } from "@/lib/audio"
import { createSession, startTranscription } from "@/hooks/use-session"
import { createClient } from "@/lib/supabase/client"

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
  const router = useRouter()
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingContext, setMeetingContext] = useState("")
  const [meetingLanguage, setMeetingLanguage] = useState<"he" | "en">("he")
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessingRecording, setIsProcessingRecording] = useState(false)
  const [recordingMode, setRecordingMode] = useState<RecordingMode>(null)
  const [audioMode, setAudioMode] = useState<AudioMode | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
  }, [processFile, t])

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
            title: meetingTitle || `Recording ${new Date().toLocaleDateString()}`,
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
            title: meetingTitle || `Recording ${new Date().toLocaleDateString()}`,
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
            title: meetingTitle || `Recording ${new Date().toLocaleDateString()}`,
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
            title: meetingTitle || `Recording ${new Date().toLocaleDateString()}`,
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
    pause: pauseInPersonRecording,
    resume: resumeInPersonRecording,
  } = useRecording({
    mode: audioMode || "microphone",
    onChunk: handleChunk,
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
  const isInPersonPaused = recordingState === "paused"
  const isInPersonRequesting = recordingState === "requesting"

  // Handle in-person recording completion
  useEffect(() => {
    const MIN_VALID_BLOB_SIZE = 1000
    if (inPersonAudioBlob && inPersonAudioBlob.size >= MIN_VALID_BLOB_SIZE &&
        recordingState === "stopped" && !completedRef.current && recordingMode === "in-person") {
      completedRef.current = true
      handleRecordingComplete(inPersonAudioBlob)
    }
  }, [inPersonAudioBlob, recordingState, handleRecordingComplete, recordingMode])

  const handleStartInPerson = useCallback(async () => {
    if (!audioMode) return
    completedRef.current = false
    await startInPersonRecording()
  }, [audioMode, startInPersonRecording])

  const handleStopInPerson = useCallback(() => {
    if (recordingDuration < 2) {
      toast.warning(t("recording.tooShort") || "Please record at least a few seconds", {
        duration: 3000,
      })
      return
    }
    stopInPersonRecording()
  }, [stopInPersonRecording, recordingDuration, t])

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background py-8" dir="rtl">
      <div className="max-w-2xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">{t("nav.newMeeting")}</h1>
          <p className="text-muted-foreground">{t("upload.pageDescription")}</p>
        </div>

        {/* Meeting Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">{t("upload.meetingDetails")}</CardTitle>
            <CardDescription>{t("upload.contextDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">{t("upload.meetingTitle")}</Label>
              <Input
                id="title"
                placeholder={t("upload.titlePlaceholder")}
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="context">{t("upload.contextTitle")}</Label>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Info className="w-3 h-3" aria-hidden="true" />
                  {t("upload.contextHelp")}
                </span>
              </div>
              <Textarea
                id="context"
                placeholder={t("upload.contextPlaceholder")}
                value={meetingContext}
                onChange={(e) => setMeetingContext(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("language.title")}</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="language"
                    value="he"
                    checked={meetingLanguage === "he"}
                    onChange={() => setMeetingLanguage("he")}
                    className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                  />
                  <span className="text-sm">{t("language.hebrewDefault")}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="language"
                    value="en"
                    checked={meetingLanguage === "en"}
                    onChange={() => setMeetingLanguage("en")}
                    className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
                  />
                  <span className="text-sm">{t("language.english")}</span>
                </label>
              </div>
              <p className="text-xs text-muted-foreground">{t("language.description")}</p>
            </div>
          </CardContent>
        </Card>

        {/* Recording/Upload Tabs */}
        <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="w-full rounded-none border-b bg-transparent h-auto p-0">
                <TabsTrigger
                  value="upload"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent py-4"
                >
                  <Upload className="w-4 h-4 ms-2" aria-hidden="true" />
                  {t("upload.title")}
                </TabsTrigger>
                <TabsTrigger
                  value="record"
                  className="flex-1 rounded-none border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:bg-transparent py-4"
                >
                  <Mic className="w-4 h-4 ms-2" aria-hidden="true" />
                  {t("recording.liveRecording")}
                </TabsTrigger>
              </TabsList>

              {/* Upload Tab */}
              <TabsContent value="upload" className="m-0 p-6">
                <div
                  role="button"
                  tabIndex={0}
                  aria-label={t("upload.dragHere")}
                  className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 ${
                    isDragging ? "border-teal-500 bg-teal-50" : "border-border hover:border-teal-300"
                  }`}
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
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      fileInputRef.current?.click()
                    }
                  }}
                >
                  <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Upload className="w-8 h-8 text-teal-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-medium mb-2">{t("upload.dragHere")}</h3>
                  <p className="text-muted-foreground mb-4">{t("upload.or")}</p>
                  <Button variant="outline" className="pointer-events-none bg-transparent" aria-hidden="true">
                    {t("upload.selectFiles")}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="audio/*,video/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                    aria-label={t("upload.selectFiles")}
                  />
                  <p className="text-xs text-muted-foreground mt-4">
                    {t("upload.supportedFormats")}
                  </p>
                </div>
              </TabsContent>

              {/* Record Tab - Split into in-person and online modes */}
              <TabsContent value="record" className="m-0 p-6">
                {isProcessingRecording ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="flex flex-col items-center justify-center py-12 gap-4"
                  >
                    <Loader2 className="h-12 w-12 animate-spin text-teal-600" aria-hidden="true" />
                    <p className="font-medium">{t("upload.processing")}</p>
                  </div>
                ) : !recordingMode ? (
                  // Mode Selection
                  <div className="space-y-4">
                    <p className="text-center text-muted-foreground mb-6">בחר את סוג ההקלטה</p>

                    <div className="grid grid-cols-2 gap-4">
                      {/* In-Person Recording */}
                      <button
                        onClick={() => setRecordingMode("in-person")}
                        className="p-6 border-2 border-border rounded-xl hover:border-teal-300 hover:bg-teal-50/50 transition-all text-center group"
                      >
                        <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-teal-200 transition-colors">
                          <Users className="w-8 h-8 text-teal-600" />
                        </div>
                        <h3 className="font-medium mb-2">פגישה פיזית</h3>
                        <p className="text-sm text-muted-foreground">הקלטה ישירה מהמיקרופון</p>
                      </button>

                      {/* Online Meeting Recording */}
                      <button
                        onClick={() => setRecordingMode("online")}
                        className="p-6 border-2 border-border rounded-xl hover:border-teal-300 hover:bg-teal-50/50 transition-all text-center group"
                      >
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors">
                          <Monitor className="w-8 h-8 text-blue-600" />
                        </div>
                        <h3 className="font-medium mb-2">פגישה מקוונת</h3>
                        <p className="text-sm text-muted-foreground">Zoom, Teams, Meet וכו׳</p>
                      </button>
                    </div>
                  </div>
                ) : recordingMode === "online" ? (
                  // Online Meeting Mode
                  <div className="space-y-6">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Monitor className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">הקלטת פגישה מקוונת</h3>
                    </div>

                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-right">
                      <h4 className="font-medium text-blue-900 mb-3">הוראות:</h4>
                      <ol className="space-y-3 text-sm text-blue-800">
                        <li className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center flex-shrink-0 font-medium">
                            1
                          </span>
                          <span>לחצו על &apos;התחל הקלטה&apos;</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center flex-shrink-0 font-medium">
                            2
                          </span>
                          <span>בחלון שייפתח, בחרו את המסך או החלון שברצונכם לשתף</span>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center flex-shrink-0 font-medium">
                            3
                          </span>
                          <span>
                            <strong className="text-blue-900">חשוב:</strong> סמנו את האפשרות &apos;שתף שמע&apos; (Share
                            audio) בתחתית החלון
                          </span>
                        </li>
                        <li className="flex gap-3">
                          <span className="w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center flex-shrink-0 font-medium">
                            4
                          </span>
                          <span>לחצו &apos;שתף&apos; להתחלת ההקלטה</span>
                        </li>
                      </ol>
                    </div>

                    <div className="flex justify-center gap-3 mb-4">
                      <Button variant="outline" onClick={() => setRecordingMode(null)} className="bg-transparent">
                        חזרה
                      </Button>
                    </div>

                    <Recorder
                      onRecordingComplete={handleRecordingComplete}
                      onChunk={handleChunk}
                    />
                  </div>
                ) : (
                  // In-Person Mode - Integrated View
                  <div className="space-y-6">
                    {/* Header */}
                    <div className="text-center">
                      <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-teal-600" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">הקלטת פגישה פיזית</h3>
                      <p className="text-muted-foreground mb-4">וודא שהמיקרופון מחובר ויש לך הרשאות מתאימות</p>
                    </div>

                    <div className="flex justify-center gap-3 mb-4">
                      <Button variant="outline" onClick={() => { setRecordingMode(null); setAudioMode(null) }} className="bg-transparent">
                        חזרה
                      </Button>
                    </div>

                    {/* Recording Error Alert */}
                    {recordingError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-red-800">{t("common.error")}</p>
                          <p className="text-sm text-red-600">{recordingError.message}</p>
                        </div>
                      </div>
                    )}

                    {/* Mode Selector - Only show when idle */}
                    {isInPersonIdle && (
                      <div className="space-y-4">
                        <h3 className="text-base font-medium">{t("recording.selectMode")}</h3>
                        <ModeSelector
                          selectedMode={audioMode}
                          onSelectMode={setAudioMode}
                          disabled={!isInPersonIdle}
                        />
                      </div>
                    )}

                    {/* Waveform Area */}
                    <div className="bg-gray-800 rounded-lg overflow-hidden">
                      {isInPersonIdle && audioMode && (
                        <IdleWaveform className="w-full h-24" />
                      )}
                      {(isInPersonRecording || isInPersonPaused) && recordingStream && (
                        <Waveform
                          stream={recordingStream}
                          className="w-full h-24"
                          barColor={isInPersonPaused ? "#6b7280" : "#14b8a6"}
                        />
                      )}
                      {!audioMode && isInPersonIdle && (
                        <div className="w-full h-24 flex items-center justify-center">
                          <p className="text-gray-500 text-sm">{t("recording.selectModeFirst")}</p>
                        </div>
                      )}
                    </div>

                    {/* Timer */}
                    <RecordingTimer
                      duration={recordingDuration}
                      isRecording={isInPersonRecording}
                    />

                    {/* Controls */}
                    <div className="flex flex-col items-center gap-4">
                      {(isInPersonIdle || isInPersonRequesting) && (
                        <Button
                          size="lg"
                          onClick={handleStartInPerson}
                          disabled={!audioMode || isInPersonRequesting}
                          className="gap-2 min-w-[200px] h-14 text-lg bg-teal-600 hover:bg-teal-700 text-white shadow-lg"
                        >
                          {isInPersonRequesting ? (
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <Mic className="h-6 w-6" />
                          )}
                          {isInPersonRequesting ? t("recording.requesting") : t("recording.start")}
                        </Button>
                      )}

                      {isInPersonRecording && (
                        <div className="flex items-center gap-4 flex-row-reverse">
                          <Button
                            size="lg"
                            variant="destructive"
                            onClick={handleStopInPerson}
                            className="gap-2 h-14 min-w-[140px]"
                          >
                            <Square className="h-5 w-5" />
                            {t("recording.stop")}
                          </Button>
                          <Button
                            size="lg"
                            variant="outline"
                            onClick={pauseInPersonRecording}
                            className="gap-2 h-14 min-w-[140px] bg-transparent"
                          >
                            <Pause className="h-5 w-5" />
                            {t("recording.pause")}
                          </Button>
                        </div>
                      )}

                      {isInPersonPaused && (
                        <div className="flex items-center gap-4 flex-row-reverse">
                          <Button
                            size="lg"
                            variant="destructive"
                            onClick={handleStopInPerson}
                            className="gap-2 h-14 min-w-[140px]"
                          >
                            <Square className="h-5 w-5" />
                            {t("recording.stop")}
                          </Button>
                          <Button
                            size="lg"
                            onClick={resumeInPersonRecording}
                            className="gap-2 h-14 min-w-[140px] bg-teal-600 hover:bg-teal-700"
                          >
                            <Play className="h-5 w-5" />
                            {t("recording.resume")}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-lg">{t("upload.filesInProgress")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  role="status"
                  aria-live="polite"
                  className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg"
                >
                  <span aria-hidden="true">{getStatusIcon(file.status)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <span className="text-xs text-muted-foreground">{file.size}</span>
                    </div>
                    {(file.status === "uploading" || file.status === "processing") && (
                      <div className="space-y-1">
                        <Progress
                          value={file.progress}
                          className="h-1.5"
                          aria-label={`${file.name}: ${getStatusText(file.status)} ${file.progress}%`}
                        />
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
                  {file.status === "complete" && file.sessionId ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/meetings/${file.sessionId}`}>{t("upload.viewMeeting")}</Link>
                    </Button>
                  ) : file.status !== "uploading" && file.status !== "processing" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => removeFile(file.id)}
                      aria-label={`${t("common.delete")} ${file.name}`}
                    >
                      <X className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
