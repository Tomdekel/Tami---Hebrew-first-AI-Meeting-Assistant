"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FileText, Upload, X, File, ImageIcon, FileSpreadsheet } from "lucide-react"

interface Document {
  id: string
  name: string
  type: "pdf" | "image" | "spreadsheet" | "doc"
  size: string
  uploadedAt: string
}

const sampleDocuments: Document[] = [
  { id: "1", name: "מצגת Q4 סיכום.pdf", type: "pdf", size: "2.4 MB", uploadedAt: "לפני שעה" },
  { id: "2", name: "תכנון משימות.xlsx", type: "spreadsheet", size: "156 KB", uploadedAt: "לפני שעתיים" },
]

const getDocIcon = (type: Document["type"]) => {
  switch (type) {
    case "pdf":
      return <FileText className="w-5 h-5 text-red-500" />
    case "image":
      return <ImageIcon className="w-5 h-5 text-blue-500" />
    case "spreadsheet":
      return <FileSpreadsheet className="w-5 h-5 text-green-500" />
    default:
      return <File className="w-5 h-5 text-gray-500" />
  }
}

export function DocumentsPanel() {
  const [documents, setDocuments] = useState<Document[]>(sampleDocuments)
  const [isDragging, setIsDragging] = useState(false)

  const handleRemove = (id: string) => {
    setDocuments(documents.filter((d) => d.id !== id))
  }

  return (
    <div className="p-4 space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragging ? "border-teal-500 bg-teal-50" : "border-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          // Handle file drop
        }}
      >
        <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground mb-2">גרור קבצים לכאן או</p>
        <Button variant="outline" size="sm">
          בחר קבצים
        </Button>
        <p className="text-xs text-muted-foreground mt-2">PDF, תמונות, מסמכים עד 10MB</p>
      </div>

      {/* Documents List */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">קבצים מצורפים</h4>
        {documents.map((doc) => (
          <div key={doc.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg group">
            {getDocIcon(doc.type)}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{doc.name}</p>
              <p className="text-xs text-muted-foreground">
                {doc.size} • {doc.uploadedAt}
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
        ))}
      </div>
    </div>
  )
}
