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

// Speaker colors for visual distinction
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

  // Filter out soft-deleted segments
  const allSegments = useMemo(
    () => rawSegments.filter((s) => !s.is_deleted),
    [rawSegments]
  )

  // Build speaker color map
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

  // Normalize search query
  const normalizedSearch = useMemo(() => searchQuery.trim().toLowerCase(), [searchQuery])

  // Filter segments based on search query
  const filteredSegments = useMemo(() => {
    if (!normalizedSearch) return allSegments
    return allSegments.filter((s) =>
      s.text.toLowerCase().includes(normalizedSearch) ||
      (s.speaker_name || "").toLowerCase().includes(normalizedSearch)
    )
  }, [allSegments, normalizedSearch])

  // Group consecutive segments by speaker
  const groupedSegments = useMemo(() => {
    return filteredSegments.reduce<
      Array<{ speakerId: string; speakerName: string; segments: TranscriptSegment[] }>
    >((groups, segment) => {
      const lastGroup = groups[groups.length - 1]

      if (lastGroup && lastGroup.speakerId === segment.speaker_id) {
        lastGroup.segments.push(segment)
      } else {
        groups.push({
          speakerId: segment.speaker_id,
          speakerName: segment.speaker_name || segment.speaker_id,
          segments: [segment],
        })
      }

      return groups
    }, [])
  }, [filteredSegments])

  // Highlight search matches in text
  const highlightText = useCallback((text: string): React.ReactNode => {
    if (!normalizedSearch) return text
    const regex = new RegExp(`(${normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
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

  // Find active segment based on current time
  const activeSegmentId = useMemo(() => {
    for (const segment of filteredSegments) {
      if (currentTime >= segment.start_time && currentTime <= segment.end_time) {
        return segment.id
      }
    }
    return null
  }, [currentTime, filteredSegments])

  // Auto-scroll to active segment
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
      {/* Header */}
      <div className="p-4 border-b border-border space-y-3">
        <div>
          <h3 className="font-medium text-foreground">{t("meeting.transcript")}</h3>
          <p className="text-sm text-muted-foreground mt-1">{t("meeting.clickToEditSpeaker")}</p>
        </div>
        <div className="relative">
          <Search className={`absolute ${isRTL ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground`} />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("meeting.searchTranscript")}
            className={`${isRTL ? "pr-9" : "pl-9"} bg-muted/50`}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              className={`absolute ${isRTL ? "left-1" : "right-1"} top-1/2 -translate-y-1/2 h-7 w-7 p-0`}
              onClick={() => setSearchQuery("")}
            >
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
        {searchQuery && (
          <p className="text-xs text-muted-foreground">
            {t("meeting.foundResults", { count: filteredSegments.length })}
          </p>
        )}
      </div>

      {/* Transcript content */}
      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {groupedSegments.map((group, groupIndex) => {
          const colorIndex = speakerColorMap.get(group.speakerId) ?? 0
          const color = SPEAKER_COLORS[colorIndex]

          return (
            <div key={`${group.speakerId}-${groupIndex}`} className="space-y-2">
              {group.segments.map((segment) => {
                const isActive = segment.id === activeSegmentId

                return (
                  <div
                    key={segment.id}
                    ref={isActive ? activeSegmentRef : null}
                    className={cn(
                      "flex gap-3 p-3 rounded-lg transition-colors",
                      isActive ? "bg-teal-50" : "hover:bg-muted/50"
                    )}
                  >
                    <Avatar className={cn("h-8 w-8 flex-shrink-0", color.bg)}>
                      <AvatarFallback className={cn(color.bg, color.text)}>
                        {getInitials(group.speakerName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {editingSpeakerId === group.speakerId ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-6 w-32 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveEdit()
                                if (e.key === "Escape") handleCancelEdit()
                              }}
                            />
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleSaveEdit}>
                              <Check className="w-3 h-3 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCancelEdit}>
                              <X className="w-3 h-3 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(group.speakerId, group.speakerName)}
                            className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-teal-600 group"
                          >
                            {group.speakerName}
                            <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                      <p className="text-sm text-foreground leading-relaxed">
                        {highlightText(segment.text)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}

        {filteredSegments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            {(status === "processing" || status === "refining") ? (
              <>
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-teal-400/20 rounded-full animate-ping" />
                  <div className="relative bg-teal-50 rounded-full p-4">
                    <Loader2 className="h-10 w-10 animate-spin text-teal-600" />
                  </div>
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">
                  {status === "processing" ? t("meeting.transcribingRecording") : t("meeting.improvingAccuracy")}
                </h3>
                <p className="text-sm text-muted-foreground text-center max-w-xs">
                  {status === "processing"
                    ? t("meeting.transcribingDesc")
                    : t("meeting.refiningDesc")}
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
                  <div className="w-2 h-2 bg-teal-600 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
                </div>
              </>
            ) : normalizedSearch && allSegments.length > 0 ? (
              <span className="text-muted-foreground">{t("meeting.noResultsFor", { query: searchQuery })}</span>
            ) : (
              <span className="text-muted-foreground">{t("meeting.noTranscript")}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
