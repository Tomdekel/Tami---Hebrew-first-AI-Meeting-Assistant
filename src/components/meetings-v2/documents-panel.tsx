"use client"

import { useState, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { FileText, Upload, X, File, ImageIcon, FileSpreadsheet, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export interface Attachment {
  id: string
  name: string
  fileUrl: string
  fileType: string
  fileSize: number
  createdAt: string
}

interface DocumentsPanelProps {
  sessionId: string
  attachments: Attachment[]
  onAttachmentsChange?: (attachments: Attachment[]) => void
  isLoading?: boolean
}

const MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "עכשיו"
  if (diffMins < 60) return `לפני ${diffMins} דקות`
  if (diffHours < 24) return `לפני ${diffHours === 1 ? "שעה" : diffHours + " שעות"}`
  if (diffDays < 7) return `לפני ${diffDays === 1 ? "יום" : diffDays + " ימים"}`
  return date.toLocaleDateString("he-IL")
}

const getDocIcon = (fileType: string) => {
  if (fileType.includes("pdf")) {
    return <FileText className="w-5 h-5 text-red-500" />
  }
  if (fileType.includes("image")) {
    return <ImageIcon className="w-5 h-5 text-blue-500" />
  }
  if (fileType.includes("spreadsheet") || fileType.includes("excel") || fileType.includes("csv")) {
    return <FileSpreadsheet className="w-5 h-5 text-green-500" />
  }
  return <File className="w-5 h-5 text-gray-500" />
}

export function DocumentsPanel({
  sessionId,
  attachments,
  onAttachmentsChange,
  isLoading = false,
}: DocumentsPanelProps) {
  const t = useTranslations()
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  // Use ref to track latest attachments to avoid stale closure
  const attachmentsRef = useRef(attachments)
  attachmentsRef.current = attachments

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const uploadFiles = useCallback(async (files: File[]) => {
    setIsUploading(true)
    const uploadedAttachments: Attachment[] = []

    try {
      for (const file of files) {
        // Validate file size
        if (file.size > MAX_FILE_SIZE) {
          toast.error(`${file.name} גדול מדי (מקסימום 100MB)`)
          continue
        }

        const formData = new FormData()
        formData.append("file", file)

        const response = await fetch(`/api/sessions/${sessionId}/attachments`, {
          method: "POST",
          body: formData,
        })

        if (!response.ok) {
          const data = await response.json()
          toast.error(`${file.name}: ${data.error || "העלאה נכשלה"}`)
          continue
        }

        const data = await response.json()
        uploadedAttachments.push(data.attachment)
        toast.success(`${file.name} הועלה בהצלחה`)
      }

      // Update attachments with all newly uploaded files using ref for fresh state
      if (uploadedAttachments.length > 0 && onAttachmentsChange) {
        onAttachmentsChange([...uploadedAttachments, ...attachmentsRef.current])
      }
    } catch (error) {
      console.error("Upload error:", error)
      toast.error(t("upload.failed"))
    } finally {
      setIsUploading(false)
    }
  }, [sessionId, onAttachmentsChange, t])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        await uploadFiles(files)
      }
    },
    [uploadFiles]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        await uploadFiles(files)
      }
      // Reset input
      e.target.value = ""
    },
    [uploadFiles]
  )

  const handleRemove = async (id: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/attachments/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Delete failed")
      }

      if (onAttachmentsChange) {
        onAttachmentsChange(attachments.filter((a) => a.id !== id))
      }

      toast.success("הקובץ נמחק")
    } catch (error) {
      console.error("Delete error:", error)
      toast.error(t("common.error"))
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-white p-4">
        <div className="text-muted-foreground text-sm">{t("common.loading")}</div>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4 bg-white h-full overflow-y-auto">
      {/* Upload Area */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragging ? "border-teal-500 bg-teal-50" : "border-border",
          isUploading && "opacity-50 pointer-events-none"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isUploading ? (
          <Loader2 className="w-8 h-8 text-teal-600 mx-auto mb-2 animate-spin" />
        ) : (
          <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        )}
        <p className="text-sm text-muted-foreground mb-2">
          {isUploading ? "מעלה..." : "גרור קבצים לכאן או"}
        </p>
        <label>
          <input
            type="file"
            className="hidden"
            multiple
            onChange={handleFileSelect}
            disabled={isUploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
          />
          <Button variant="outline" size="sm" disabled={isUploading} asChild>
            <span className="cursor-pointer">בחר קבצים</span>
          </Button>
        </label>
        <p className="text-xs text-muted-foreground mt-2">PDF, תמונות, מסמכים עד 100MB</p>
      </div>

      {/* Documents List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">
          {t("meeting.attachments")} ({attachments.length})
        </h4>

        {attachments.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground text-sm">{t("meeting.noAttachmentsYet")}</p>
          </div>
        ) : (
          attachments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group"
            >
              {getDocIcon(doc.fileType)}
              <div className="flex-1 min-w-0">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium truncate block hover:text-teal-600"
                >
                  {doc.name}
                </a>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(doc.fileSize)} • {formatRelativeTime(doc.createdAt)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                onClick={() => handleRemove(doc.id)}
                aria-label={`${t("common.delete")} ${doc.name}`}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
