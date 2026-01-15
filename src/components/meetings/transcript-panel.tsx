"use client"

import { useState, useMemo, useRef, useEffect, useCallback } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pencil, Check, X, Search, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"
import { getSpeakerColor } from "@/lib/speaker-colors"

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
  nameSuggestions?: string[]
  highlightedSegmentId?: string | null
}


export function TranscriptPanel({
  transcript,
  speakerNames,
  onSpeakerNameChange,
  nameSuggestions = [],
  highlightedSegmentId = null,
}: TranscriptPanelProps) {
  const { isRTL } = useLanguage()
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null)
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState("")
  const [highlightedTime, setHighlightedTime] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentResultIndex, setCurrentResultIndex] = useState(0)
  const suggestionsId = "speaker-name-suggestions"
  const resultRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const handleStartEdit = (speakerId: string, segmentId: string, currentName: string) => {
    setEditingSpeakerId(speakerId)
    setEditingSegmentId(segmentId)
    setEditingName(currentName)
  }

  const handleSaveEdit = () => {
    if (editingSpeakerId && editingName.trim()) {
      onSpeakerNameChange(editingSpeakerId, editingName.trim())
    }
    setEditingSpeakerId(null)
    setEditingSegmentId(null)
    setEditingName("")
  }

  const handleCancelEdit = () => {
    setEditingSpeakerId(null)
    setEditingSegmentId(null)
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

  // Reset and clamp current result index when search changes
  useEffect(() => {
    setCurrentResultIndex(prev => {
      if (filteredTranscript.length === 0) return 0
      return Math.min(prev, filteredTranscript.length - 1)
    })
  }, [searchQuery, filteredTranscript.length])

  // Scroll to current result
  const scrollToResult = useCallback((index: number) => {
    if (filteredTranscript.length === 0) return
    const item = filteredTranscript[index]
    if (!item) return
    const element = resultRefs.current.get(item.id)
    if (element && scrollContainerRef.current) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [filteredTranscript])

  // Navigate to next/prev result
  const goToNextResult = useCallback(() => {
    if (filteredTranscript.length === 0) return
    const nextIndex = (currentResultIndex + 1) % filteredTranscript.length
    setCurrentResultIndex(nextIndex)
    scrollToResult(nextIndex)
  }, [currentResultIndex, filteredTranscript.length, scrollToResult])

  const goToPrevResult = useCallback(() => {
    if (filteredTranscript.length === 0) return
    const prevIndex = currentResultIndex === 0 ? filteredTranscript.length - 1 : currentResultIndex - 1
    setCurrentResultIndex(prevIndex)
    scrollToResult(prevIndex)
  }, [currentResultIndex, filteredTranscript.length, scrollToResult])

  // Keyboard shortcut for search navigation (Enter/Shift+Enter when focused on search)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!searchQuery || filteredTranscript.length === 0) return
    if (e.key === 'Enter') {
      e.preventDefault()
      if (e.shiftKey) {
        goToPrevResult()
      } else {
        goToNextResult()
      }
    }
  }, [searchQuery, filteredTranscript.length, goToNextResult, goToPrevResult])

  // Escape special regex characters to prevent crashes
  const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text
    const regex = new RegExp(`(${escapeRegex(query)})`, "gi")
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
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
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
        {searchQuery && filteredTranscript.length > 0 && (
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground">
              {isRTL
                ? `תוצאה ${currentResultIndex + 1} מתוך ${filteredTranscript.length}`
                : `Result ${currentResultIndex + 1} of ${filteredTranscript.length}`}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={goToPrevResult}
                disabled={filteredTranscript.length <= 1}
                title={isRTL ? "תוצאה קודמת (Shift+Enter)" : "Previous result (Shift+Enter)"}
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={goToNextResult}
                disabled={filteredTranscript.length <= 1}
                title={isRTL ? "תוצאה הבאה (Enter)" : "Next result (Enter)"}
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
        {searchQuery && filteredTranscript.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {isRTL ? "לא נמצאו תוצאות" : "No results found"}
          </p>
        )}
      </div>

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {filteredTranscript.map((item, index) => (
          <div
            key={item.id}
            ref={(el) => {
              if (el) resultRefs.current.set(item.id, el)
            }}
            className={cn(
              "flex gap-3 p-3 rounded-lg transition-colors",
              highlightedSegmentId === item.id || highlightedTime === item.time
                ? "bg-teal-50"
                : searchQuery && index === currentResultIndex
                  ? "bg-yellow-50 ring-2 ring-yellow-300"
                  : "hover:bg-muted/50",
            )}
          >
            {(() => {
              const color = getSpeakerColor(item.speakerId)
              return (
                <Avatar className={cn("h-8 w-8 flex-shrink-0 text-xs", color.bg, color.text)}>
                  <AvatarFallback className={cn("text-xs font-medium", color.bg, color.text)}>
                    {getInitials(item.speaker)}
                  </AvatarFallback>
                </Avatar>
              )
            })()}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                {editingSegmentId === item.id ? (
                  <div className="flex items-center gap-1">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-5 w-24 text-xs"
                      autoFocus
                      list={nameSuggestions.length ? suggestionsId : undefined}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleSaveEdit()
                        }
                        if (e.key === "Escape") handleCancelEdit()
                      }}
                    />
                    {nameSuggestions.length > 0 && (
                      <datalist id={suggestionsId}>
                        {nameSuggestions.map((suggestion) => (
                          <option key={suggestion} value={suggestion} />
                        ))}
                      </datalist>
                    )}
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleSaveEdit}>
                      <Check className="w-3 h-3 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleCancelEdit}>
                      <X className="w-3 h-3 text-red-600" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartEdit(item.speakerId, item.id, item.speaker)}
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
