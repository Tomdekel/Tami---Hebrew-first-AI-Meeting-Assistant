"use client"

import { useState, useMemo } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Check, X, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"

interface TranscriptItem {
  id: string
  speaker: string
  speakerId: string
  time: string
  text: string
}

interface TranscriptPanelProps {
  transcript: TranscriptItem[]
  speakerNames: Record<string, string>
  onSpeakerNameChange: (speakerId: string, newName: string) => void
}

const speakerColors: Record<string, string> = {
  "speaker-1": "bg-teal-100 text-teal-700",
  "speaker-2": "bg-blue-100 text-blue-700",
  "speaker-3": "bg-amber-100 text-amber-700",
}

export function TranscriptPanel({ transcript, speakerNames, onSpeakerNameChange }: TranscriptPanelProps) {
  const { isRTL } = useLanguage()
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [highlightedTime, setHighlightedTime] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const handleStartEdit = (speakerId: string, currentName: string) => {
    setEditingSpeakerId(speakerId)
    setEditingName(currentName)
  }

  const handleSaveEdit = () => {
    if (editingSpeakerId && editingName.trim()) {
      onSpeakerNameChange(editingSpeakerId, editingName.trim())
    }
    setEditingSpeakerId(null)
    setEditingName("")
  }

  const handleCancelEdit = () => {
    setEditingSpeakerId(null)
    setEditingName("")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
  }

  const filteredTranscript = useMemo(() => {
    if (!searchQuery.trim()) return transcript
    const query = searchQuery.toLowerCase()
    return transcript.filter(
      (item) => item.text.toLowerCase().includes(query) || item.speaker.toLowerCase().includes(query),
    )
  }, [transcript, searchQuery])

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${query})`, "gi")
    const parts = text.split(regex)
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      ),
    )
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
              isRTL ? "right-3" : "left-3",
            )}
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isRTL ? "חיפוש בתמליל..." : "Search transcript..."}
            className={cn("bg-muted/50 h-8 text-sm", isRTL ? "pr-9" : "pl-9")}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className={cn("absolute top-1/2 -translate-y-1/2 h-6 w-6 p-0", isRTL ? "left-1" : "right-1")}
              onClick={() => setSearchQuery("")}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-muted-foreground mt-1">
            {isRTL ? `נמצאו ${filteredTranscript.length} תוצאות` : `Found ${filteredTranscript.length} results`}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredTranscript.map((item) => (
          <div
            key={item.id}
            className={cn(
              "flex gap-2 p-2 rounded-lg transition-colors",
              highlightedTime === item.time ? "bg-teal-50" : "hover:bg-muted/50",
            )}
          >
            <Avatar className={cn("h-6 w-6 flex-shrink-0 text-xs", speakerColors[item.speakerId])}>
              <AvatarFallback className={cn("text-xs", speakerColors[item.speakerId])}>
                {getInitials(item.speaker)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {editingSpeakerId === item.speakerId ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-5 w-24 text-xs"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit()
                        if (e.key === "Escape") handleCancelEdit()
                      }}
                    />
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleSaveEdit}>
                      <Check className="w-3 h-3 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleCancelEdit}>
                      <X className="w-3 h-3 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartEdit(item.speakerId, item.speaker)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-600 group"
                  >
                    {item.speaker}
                    <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                )}
                <button
                  onClick={() => setHighlightedTime(item.time)}
                  className="text-xs text-muted-foreground hover:text-teal-600 font-mono"
                  dir="ltr"
                >
                  {item.time}
                </button>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{highlightText(item.text, searchQuery)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
