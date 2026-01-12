"use client"

import { useState } from "react"
import { Search, Calendar, Clock, Users, Loader2, AlertCircle, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import type { Session } from "@/lib/types/database"
import { useTranslations, useLocale } from "next-intl"

interface MeetingsSidebarProps {
  sessions: Session[]
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete?: (id: string) => Promise<void>
  isLoading?: boolean
  className?: string
}

export function MeetingsSidebar({ sessions, selectedId, onSelect, onDelete, isLoading, className }: MeetingsSidebarProps) {
  const [search, setSearch] = useState("")
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const t = useTranslations()
  const locale = useLocale()
  const isRTL = locale === "he"

  const handleDeleteClick = (e: React.MouseEvent, session: Session) => {
    e.stopPropagation()
    setSessionToDelete(session)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!sessionToDelete || !onDelete) return
    setIsDeleting(true)
    try {
      await onDelete(sessionToDelete.id)
      setDeleteDialogOpen(false)
      setSessionToDelete(null)
    } finally {
      setIsDeleting(false)
    }
  }

  const filteredSessions = sessions.filter((s) =>
    s.title?.toLowerCase().includes(search.toLowerCase())
  )

  const formatDuration = (durationSeconds: number | null | undefined): string => {
    if (!durationSeconds) return ""
    const minutes = Math.round(durationSeconds / 60)
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}:${remainingMinutes.toString().padStart(2, "0")}h` : `${hours}h`
  }

  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return ""
    const date = new Date(dateStr)
    return date.toLocaleDateString(isRTL ? "he-IL" : "en-US", { day: "numeric", month: "numeric", year: "numeric" })
  }

  const getParticipantCount = (session: Session): number | null => {
    // Use participant_count if available (populated after transcription)
    // Otherwise return null to hide the field
    return session.participant_count ?? null
  }

  return (
    <div className={cn("w-72 flex-shrink-0 border-l border-border bg-sidebar flex flex-col h-full", className)}>
      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
              isRTL ? "right-3" : "left-3"
            )}
          />
          <Input
            placeholder={t("search.placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn("bg-white", isRTL ? "pr-9" : "pl-9")}
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
              {search ? t("common.noResults") : t("meeting.noMeetingsYet")}
            </div>
          ) : (
            filteredSessions.map((session) => {
              const participantCount = getParticipantCount(session)
              const isProcessing = session.status === "processing" || session.status === "refining"
              const isFailed = session.status === "failed" || session.status === "expired"

              return (
                <div
                  key={session.id}
                  className={cn(
                    "group relative w-full p-3 rounded-lg transition-colors cursor-pointer",
                    isRTL ? "text-right" : "text-left",
                    selectedId === session.id ? "bg-teal-50 border border-teal-200" : "hover:bg-muted"
                  )}
                  onClick={() => onSelect(session.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium text-sm text-foreground truncate flex-1">
                      {session.title || t("meeting.untitled")}
                    </h4>
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteClick(e, session)}
                        aria-label={t("meeting.delete")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {isProcessing && (
                      <span className="flex items-center gap-1 text-xs text-teal-600">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {session.status === "processing" ? t("meeting.transcribing") : t("meeting.refining")}
                      </span>
                    )}
                    {isFailed && (
                      <span className="flex items-center gap-1 text-xs text-red-600">
                        <AlertCircle className="w-3 h-3" />
                        {session.status === "expired" ? t("meeting.timedOut") : t("meeting.failed")}
                      </span>
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-3 mt-1.5 text-xs text-muted-foreground",
                      isRTL && "flex-row-reverse justify-end"
                    )}
                  >
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
                  {participantCount !== null && participantCount > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" />
                      <span>{participantCount} {t("meeting.participants")}</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("meeting.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("meeting.deleteConfirmDescription", { title: sessionToDelete?.title || t("meeting.untitled") })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : t("meeting.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
