"use client"

import { useState } from "react"
import { Search, Calendar, Clock, Users } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { Session } from "@/lib/types/database"
import { useTranslations } from "next-intl"

interface MeetingsSidebarProps {
  sessions: Session[]
  selectedId: string | null
  onSelect: (id: string) => void
  isLoading?: boolean
}

export function MeetingsSidebar({ sessions, selectedId, onSelect, isLoading }: MeetingsSidebarProps) {
  const [search, setSearch] = useState("")
  const t = useTranslations()

  const filteredSessions = sessions.filter((s) =>
    s.title?.toLowerCase().includes(search.toLowerCase())
  )

  const formatDuration = (durationSeconds: number | null | undefined): string => {
    if (!durationSeconds) return ""
    const minutes = Math.round(durationSeconds / 60)
    if (minutes < 60) return `${minutes} דקות`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}:${remainingMinutes.toString().padStart(2, "0")} שעות` : `${hours} שעות`
  }

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    return date.toLocaleDateString("he-IL", { day: "numeric", month: "numeric", year: "numeric" })
  }

  const getParticipantCount = (_session: Session): number => {
    // Session type doesn't include nested transcript in list view
    // Return 1 as placeholder - actual count is fetched when meeting is opened
    return 1
  }

  return (
    <div className="w-72 flex-shrink-0 border-r border-border bg-sidebar flex flex-col h-full">
      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="חיפוש פגישות..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-9 bg-white"
          />
        </div>
      </div>

      {/* Meetings List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 rounded-lg animate-pulse">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))
          ) : filteredSessions.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              {search ? "לא נמצאו פגישות" : "אין פגישות עדיין"}
            </div>
          ) : (
            filteredSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={cn(
                  "w-full text-right p-3 rounded-lg transition-colors",
                  selectedId === session.id ? "bg-teal-50 border border-teal-200" : "hover:bg-muted"
                )}
              >
                <h4 className="font-medium text-sm text-foreground truncate">
                  {session.title || t("meeting.untitled")}
                </h4>
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  {session.created_at && (
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(session.created_at)}
                    </span>
                  )}
                  {session.duration_seconds && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(session.duration_seconds)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                  <Users className="w-3 h-3" />
                  <span>{getParticipantCount(session)} משתתפים</span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
