"use client"

import { useState, useMemo, useCallback, useRef, useEffect } from "react"
import { useTranslations, useLocale } from "next-intl"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Check, X, Search, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TranscriptSegment, SessionStatus } from "@/lib/types/database"

interface TranscriptPanelProps {
  segments: TranscriptSegment[]
  currentTime?: number
  onSeek?: (time: number) => void
  onEditSpeaker?: (speakerId: string, currentName: string) => void
  className?: string
  status?: SessionStatus
}

const SPEAKER_COLORS = [
  { bg: "bg-teal-100", text: "text-teal-700" },
  { bg: "bg-blue-100", text: "text-blue-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
]

export function TranscriptPanel({
  segments: rawSegments,
  currentTime = 0,
  onSeek,
  onEditSpeaker,
  className,
  status,
}: TranscriptPanelProps) {
  const t = useTranslations()
  const locale = useLocale()
  const isRTL = locale === "he"
  const [searchQuery, setSearchQuery] = useState("")
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const activeSegmentRef = useRef<HTMLDivElement | null>(null)

  const allSegments = useMemo(
    () => rawSegments.filter((s) => !s.is_deleted),
    [rawSegments]
  )

  const speakerColorMap = useMemo(() => {
    const map = new Map<string, number>()
    let colorIndex = 0
    allSegments.forEach((seg) => {
      if (!map.has(seg.speaker_id)) {
        map.set(seg.speaker_id, colorIndex % SPEAKER_COLORS.length)
        colorIndex++
      }
    })
    return map
  }, [allSegments])

  const normalizedSearch = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery])

  const filteredSegments = useMemo(() => {
    if (!normalizedSearch) return allSegments
    return allSegments.filter((s) =>
      s.text.toLowerCase().includes(normalizedSearch) ||
      (s.speaker_name || "").toLowerCase().includes(normalizedSearch)
    )
  }, [allSegments, normalizedSearch])

  const highlightText = useCallback((text: string): React.ReactNode => {
    if (!normalizedSearch) return text
    const regex = new RegExp(`(${normalizedSearch.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")})`, "gi")
    const parts = text.split(regex)
    return parts.map((part, i) =>
      part.toLowerCase() === normalizedSearch ? (
        <mark key={i} className="bg-yellow-200 rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }, [normalizedSearch])

  const formatTime = useCallback((seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }, [])

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
  }

  const handleStartEdit = (speakerId: string, currentName: string) => {
    setEditingSpeakerId(speakerId)
    setEditingName(currentName)
  }

  const handleSaveEdit = () => {
    if (editingSpeakerId && editingName.trim() && onEditSpeaker) {
      onEditSpeaker(editingSpeakerId, editingName.trim())
    }
    setEditingSpeakerId(null)
    setEditingName("")
  }

  const handleCancelEdit = () => {
    setEditingSpeakerId(null)
    setEditingName("")
  }

  const handleTimeClick = (time: number) => {
    if (onSeek) {
      onSeek(time)
    }
  }

  const activeSegmentId = useMemo(() => {
    for (const segment of filteredSegments) {
      if (currentTime >= segment.start_time && currentTime <= segment.end_time) {
        return segment.id
      }
    }
    return null
  }, [currentTime, filteredSegments])

  useEffect(() => {
    if (activeSegmentRef.current) {
      activeSegmentRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }
  }, [activeSegmentId])

  return (
    <div className={cn("h-full flex flex-col bg-white", className)}>
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
              isRTL ? "right-3" : "left-3"
            )}
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("meeting.searchTranscript")}
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
            {t("meeting.foundResults", { count: filteredSegments.length })}
          </p>
        )}
      </div>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {status === "processing" && allSegments.length === 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("meeting.transcribing")}
          </div>
        )}

        {filteredSegments.length === 0 && status !== "processing" && (
          <p className="text-sm text-muted-foreground">{t("meeting.noTranscript")}</p>
        )}

        {filteredSegments.map((segment) => {
          const isActive = activeSegmentId === segment.id
          const colorIndex = speakerColorMap.get(segment.speaker_id) ?? 0
          const colors = SPEAKER_COLORS[colorIndex]
          const speakerName = segment.speaker_name || segment.speaker_id

          return (
            <div
              key={segment.id}
              ref={isActive ? activeSegmentRef : null}
              className={cn(
                "flex gap-2 p-2 rounded-lg transition-colors",
                isActive ? "bg-teal-50" : "hover:bg-muted/50"
              )}
            >
              <Avatar className={cn("h-6 w-6 flex-shrink-0 text-xs", colors.bg)}>
                <AvatarFallback className={cn("text-xs", colors.bg, colors.text)}>
                  {getInitials(speakerName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {editingSpeakerId === segment.speaker_id ? (
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
                      onClick={() => handleStartEdit(segment.speaker_id, speakerName)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-teal-600 group"
                    >
                      {speakerName}
                      <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  )}
                  <button
                    onClick={() => handleTimeClick(segment.start_time)}
                    className="text-xs text-muted-foreground hover:text-teal-600 font-mono"
                    dir="ltr"
                  >
                    {formatTime(segment.start_time)}
                  </button>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{highlightText(segment.text)}</p>
              </div>
            </div>
          )}
        )}
      </div>
    </div>
  )
}
