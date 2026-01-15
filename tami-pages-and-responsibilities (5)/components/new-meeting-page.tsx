"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import {
  Upload,
  Mic,
  Square,
  FileAudio,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  Monitor,
  Users,
  ArrowLeft,
  FileText,
} from "lucide-react"
import { useLanguage } from "@/contexts/language-context"
import { cn } from "@/lib/utils"

type UploadType = "audio" | "transcript" | "record"
type ProcessingStatus = "idle" | "uploading" | "ready" | "error"
type RecordingMode = "in-person" | "online" | null

interface UploadedFile {
  id: string
  name: string
  size: string
  status: ProcessingStatus
  progress: number
}

export function NewMeetingPage() {
  const router = useRouter()
  const { isRTL } = useLanguage()

  const [uploadType, setUploadType] = useState<UploadType>("audio")
  const [meetingTitle, setMeetingTitle] = useState("")
  const [meetingTitleError, setMeetingTitleError] = useState(false)
  const [meetingContext, setMeetingContext] = useState("")
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [recordingMode, setRecordingMode] = useState<RecordingMode>(null)
  const [recordingComplete, setRecordingComplete] = useState(false)
  const [pastedTranscript, setPastedTranscript] = useState("")

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const handleStartRecording = () => {
    setIsRecording(true)
    const interval = setInterval(() => {
      setRecordingTime((prev) => prev + 1)
    }, 1000)
    ;(window as unknown as { recordingInterval: NodeJS.Timeout }).recordingInterval = interval
  }

  const handleStopRecording = () => {
    setIsRecording(false)
    clearInterval((window as unknown as { recordingInterval: NodeJS.Timeout }).recordingInterval)
    const newFile: UploadedFile = {
      id: Date.now().toString(),
      name: isRTL
        ? `הקלטה ${new Date().toLocaleDateString("he-IL")} ${formatTime(recordingTime)}`
        : `Recording ${new Date().toLocaleDateString("en-US")} ${formatTime(recordingTime)}`,
      size: `${Math.round(recordingTime * 0.1)} MB`,
      status: "ready",
      progress: 100,
    }
    setUploadedFile(newFile)
    setRecordingTime(0)
    setRecordingMode(null)
    setRecordingComplete(true)
  }

  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const file = files[0]
    const newFile: UploadedFile = {
      id: Date.now().toString(),
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      status: "uploading",
      progress: 0,
    }
    setUploadedFile(newFile)
    simulateUpload(newFile.id)
  }

  const simulateUpload = (fileId: string) => {
    let progress = 0
    const interval = setInterval(() => {
      progress += 20
      setUploadedFile((prev) => (prev && prev.id === fileId ? { ...prev, progress } : prev))
      if (progress >= 100) {
        clearInterval(interval)
        setUploadedFile((prev) => (prev && prev.id === fileId ? { ...prev, status: "ready", progress: 100 } : prev))
      }
    }, 150)
  }

  const removeFile = () => {
    setUploadedFile(null)
    setRecordingComplete(false)
  }

  const handleStartProcessing = () => {
    if (!meetingTitle.trim()) {
      setMeetingTitleError(true)
      return
    }
    router.push("/meetings?id=new&processing=true")
  }

  const handleSaveAsDraft = () => {
    if (!meetingTitle.trim()) {
      setMeetingTitleError(true)
      return
    }
    router.push("/meetings?id=new&draft=true")
  }

  const canProceed =
    uploadedFile?.status === "ready" || recordingComplete || (uploadType === "transcript" && pastedTranscript.trim())

  const getUploadAccept = () => {
    return uploadType === "transcript" ? ".txt,.docx,.pdf" : "audio/*,video/*"
  }

  const getUploadLabel = () => {
    if (uploadType === "transcript") {
      return isRTL ? "העלה קובץ תמליל או הדבק טקסט" : "Upload transcript file or paste text"
    }
    return isRTL ? "גרור קבצי שמע/וידאו לכאן" : "Drag audio/video files here"
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background overflow-auto" dir={isRTL ? "rtl" : "ltr"}>
      <div className="max-w-2xl mx-auto px-4 py-4 md:py-6">
        <Card className="overflow-hidden">
          <CardHeader className="pb-4 flex-shrink-0">
            <CardTitle className="text-lg md:text-xl">{isRTL ? "פגישה חדשה" : "New Meeting"}</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4 pb-4">
            {/* Meeting title - touch-friendly */}
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

            {/* Segmented control - responsive */}
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
            </div>

            {/* Upload Audio */}
            {uploadType === "audio" && (
              <div
                className={cn(
                  "border-2 border-dashed rounded-xl p-4 transition-all",
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
                  handleFileUpload(e.dataTransfer.files)
                }}
              >
                {uploadedFile ? (
                  <div
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      uploadedFile.status === "error" ? "bg-red-50" : "bg-muted/50",
                    )}
                  >
                    {uploadedFile.status === "uploading" ? (
                      <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                    ) : uploadedFile.status === "ready" ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <FileAudio className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                        <span className="text-xs text-muted-foreground">{uploadedFile.size}</span>
                      </div>
                      {uploadedFile.status === "uploading" && (
                        <Progress value={uploadedFile.progress} className="h-1.5" />
                      )}
                      {uploadedFile.status === "ready" && (
                        <p className="text-xs text-green-600">{isRTL ? "מוכן לעיבוד" : "Ready to process"}</p>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={removeFile}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center mb-3">
                      <Upload className="w-6 h-6 text-teal-600" />
                    </div>
                    <h3 className="text-base font-medium mb-1">{getUploadLabel()}</h3>
                    <p className="text-muted-foreground mb-3 text-sm">{isRTL ? "או" : "or"}</p>
                    <label>
                      <input
                        type="file"
                        accept={getUploadAccept()}
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
            )}

            {/* Upload Transcript */}
            {uploadType === "transcript" && (
              <div className="space-y-3">
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-4 transition-all",
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
                    handleFileUpload(e.dataTransfer.files)
                  }}
                >
                  {uploadedFile ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                        <p className="text-xs text-green-600">{isRTL ? "מוכן לעיבוד" : "Ready to process"}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={removeFile}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-4">
                      <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mb-2">
                        <FileText className="w-5 h-5 text-teal-600" />
                      </div>
                      <label>
                        <input
                          type="file"
                          accept=".txt,.docx,.pdf"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e.target.files)}
                        />
                        <Button variant="outline" size="sm" className="cursor-pointer bg-transparent" asChild>
                          <span>{isRTL ? "העלה קובץ תמליל" : "Upload transcript file"}</span>
                        </Button>
                      </label>
                      <p className="text-xs text-muted-foreground mt-2">TXT, DOCX, PDF</p>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      {isRTL ? "או הדבק טקסט" : "or paste text"}
                    </span>
                  </div>
                </div>
                <Textarea
                  placeholder={isRTL ? "הדבק את התמליל כאן..." : "Paste transcript here..."}
                  value={pastedTranscript}
                  onChange={(e) => setPastedTranscript(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </div>
            )}

            {/* Record Live */}
            {uploadType === "record" && (
              <div className="flex-1 flex flex-col items-center justify-center py-4">
                {!recordingMode && !isRecording && !recordingComplete ? (
                  <div className="w-full max-w-sm space-y-4">
                    <p className="text-center text-muted-foreground text-sm">
                      {isRTL ? "בחר את סוג ההקלטה" : "Select recording type"}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setRecordingMode("in-person")}
                        className="p-4 border-2 border-border rounded-xl hover:border-teal-300 hover:bg-teal-50/50 transition-all text-center group"
                      >
                        <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-teal-200 transition-colors">
                          <Users className="w-5 h-5 text-teal-600" />
                        </div>
                        <h3 className="font-medium text-sm mb-1">{isRTL ? "פגישה פיזית" : "In-Person"}</h3>
                        <p className="text-xs text-muted-foreground">{isRTL ? "הקלטה מהמיקרופון" : "Mic recording"}</p>
                      </button>
                      <button
                        onClick={() => setRecordingMode("online")}
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
                ) : recordingMode === "online" && !isRecording && !recordingComplete ? (
                  <div className="text-center max-w-sm">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Monitor className="w-5 h-5 text-blue-600" />
                    </div>
                    <h3 className="font-semibold mb-3">{isRTL ? "הקלטת פגישה מקוונת" : "Online Meeting Recording"}</h3>
                    <div className="bg-blue-50 rounded-lg p-4 mb-4 text-right" dir="rtl">
                      <p className="text-sm text-blue-800 font-medium mb-2">{isRTL ? "הוראות:" : "Instructions:"}</p>
                      <ol className="text-sm text-blue-700 space-y-1.5 list-decimal list-inside">
                        <li>לחצו על &apos;התחל הקלטה&apos;</li>
                        <li>בחלון שייפתח, בחרו את המסך או החלון שברצונכם לשתף</li>
                        <li className="font-semibold">
                          חשוב: סמנו את האפשרות &apos;שתף שמע&apos; (Share audio) בתחתית החלון
                        </li>
                        <li>לחצו &apos;שתף&apos; להתחלת ההקלטה</li>
                      </ol>
                    </div>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={handleStartRecording} className="bg-blue-600 hover:bg-blue-700">
                        <Mic className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                        {isRTL ? "התחל הקלטה" : "Start Recording"}
                      </Button>
                      <Button variant="outline" onClick={() => setRecordingMode(null)}>
                        <ArrowLeft className={cn("w-4 h-4", isRTL ? "ml-2 rotate-180" : "mr-2")} />
                        {isRTL ? "חזור" : "Back"}
                      </Button>
                    </div>
                  </div>
                ) : recordingMode === "in-person" && !isRecording && !recordingComplete ? (
                  <div className="text-center">
                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users className="w-5 h-5 text-teal-600" />
                    </div>
                    <h3 className="font-semibold mb-3">{isRTL ? "הקלטת פגישה פיזית" : "In-Person Recording"}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {isRTL
                        ? "וודא שהמיקרופון פועל ולחץ להתחלה"
                        : "Make sure your microphone is working and click to start"}
                    </p>
                    <div className="flex gap-2 justify-center">
                      <Button onClick={handleStartRecording} className="bg-teal-600 hover:bg-teal-700">
                        <Mic className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                        {isRTL ? "התחל הקלטה" : "Start Recording"}
                      </Button>
                      <Button variant="outline" onClick={() => setRecordingMode(null)}>
                        <ArrowLeft className={cn("w-4 h-4", isRTL ? "ml-2 rotate-180" : "mr-2")} />
                        {isRTL ? "חזור" : "Back"}
                      </Button>
                    </div>
                  </div>
                ) : isRecording ? (
                  <div className="text-center">
                    <div className="relative w-24 h-24 mx-auto mb-4">
                      <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse" />
                      <div className="absolute inset-3 bg-red-500 rounded-full flex items-center justify-center">
                        <Mic className="w-8 h-8 text-white" />
                      </div>
                    </div>
                    <p className="text-3xl font-mono font-bold mb-2">{formatTime(recordingTime)}</p>
                    <p className="text-muted-foreground mb-4">{isRTL ? "מקליט..." : "Recording..."}</p>
                    <Button onClick={handleStopRecording} variant="destructive" size="lg">
                      <Square className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                      {isRTL ? "עצור הקלטה" : "Stop Recording"}
                    </Button>
                  </div>
                ) : recordingComplete && uploadedFile ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 w-full max-w-sm">
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{uploadedFile.name}</p>
                      <p className="text-xs text-green-600">{isRTL ? "מוכן לעיבוד" : "Ready to process"}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={removeFile}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            {/* Meeting Context */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                {isRTL ? "הקשר הפגישה (אופציונלי)" : "Meeting Context (optional)"}
              </Label>
              <Textarea
                placeholder={
                  isRTL
                    ? "פגישה בין בן ומאיה על יוזמת שיווק חדשה בגרמניה. אני מציג גישת גרילה מרקטינג ל-CMO."
                    : "Meeting between Ben and Maya about a new marketing initiative in Germany. I'm presenting a guerrilla marketing approach to the CMO."
                }
                value={meetingContext}
                onChange={(e) => setMeetingContext(e.target.value)}
                className="min-h-[80px] md:min-h-[100px] resize-none text-sm md:text-base"
              />
              <p className="text-xs text-muted-foreground">
                {isRTL
                  ? "הוספת שמות משתתפים והקשר משפרת את דיוק התמלול"
                  : "Adding participant names and context improves transcription accuracy"}
              </p>
            </div>
          </CardContent>

          <CardFooter className="border-t pt-4 flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleStartProcessing}
              disabled={!canProceed}
              className="w-full sm:flex-1 bg-teal-600 hover:bg-teal-700 h-11 md:h-10"
            >
              {isRTL ? "התחל עיבוד" : "Start Processing"}
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveAsDraft}
              disabled={!canProceed}
              className="w-full sm:w-auto h-11 md:h-10 bg-transparent"
            >
              {isRTL ? "שמור כטיוטה" : "Save as Draft"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
