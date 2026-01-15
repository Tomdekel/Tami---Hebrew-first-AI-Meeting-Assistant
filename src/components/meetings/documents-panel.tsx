"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, Upload, X, File, ImageIcon, FileSpreadsheet, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface DocumentItem {
  id: string
  name: string
  fileType: string
  fileSize: number
  createdAt: string
}

interface DocumentsPanelProps {
  sessionId: string
}

const formatFileSize = (size: number) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

const getDocIcon = (type: string) => {
  if (type.includes("pdf")) return <FileText className="w-5 h-5 text-red-500" />
  if (type.includes("image")) return <ImageIcon className="w-5 h-5 text-blue-500" />
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("sheet")) {
    return <FileSpreadsheet className="w-5 h-5 text-green-500" />
  }
  return <File className="w-5 h-5 text-gray-500" />
}

export function DocumentsPanel({ sessionId }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const loadDocuments = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/attachments`)
      if (!response.ok) return
      const data = await response.json()
      setDocuments(
        (data.attachments || []).map((doc: { id: string; name: string; fileType: string; fileSize: number; createdAt: string }) => ({
          id: doc.id,
          name: doc.name,
          fileType: doc.fileType,
          fileSize: doc.fileSize,
          createdAt: doc.createdAt,
        })),
      )
    } catch (error) {
      console.error("Failed to load attachments:", error)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [sessionId])

  const handleRemove = async (id: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}/attachments/${id}`, { method: "DELETE" })
      setDocuments((prev) => prev.filter((doc) => doc.id !== id))
    } catch (error) {
      console.error("Failed to delete attachment:", error)
    }
  }

  const handleUpload = async (file: File) => {
    const formData = new FormData()
    formData.append("file", file)
    setIsUploading(true)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/attachments`, {
        method: "POST",
        body: formData,
      })
      if (!response.ok) return
      await loadDocuments()
    } catch (error) {
      console.error("Failed to upload attachment:", error)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
          isDragging ? "border-teal-500 bg-teal-50" : "border-border",
        )}
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          const file = event.dataTransfer.files?.[0]
          if (file) handleUpload(file)
        }}
      >
        {isUploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground mb-2">Drag files here or</p>
            <label>
              <input
                type="file"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) handleUpload(file)
                }}
              />
              <Button variant="outline" size="sm" className="cursor-pointer bg-transparent" asChild>
                <span>Select files</span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground mt-2">PDF, images, docs up to 100MB</p>
          </>
        )}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">Attached files</h4>
        {documents.length === 0 ? (
          <p className="text-xs text-muted-foreground">No attachments yet.</p>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group">
              {getDocIcon(doc.fileType)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(doc.fileSize)} • {new Date(doc.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemove(doc.id)}
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
