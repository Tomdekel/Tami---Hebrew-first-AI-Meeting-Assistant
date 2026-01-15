"use client"

import { useState } from "react"
import { Search, Calendar, Clock, Users, Loader2, AlertCircle, RefreshCw, FileText } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"
import type { ProcessingStepKey } from "@/components/processing-stepper"

interface Meeting {
  id: string
  title: string
  date: string
  time: string
  duration: string
  participants: string[]
  status: "completed" | "processing" | "pending" | "draft" | "failed"
  currentStep?: ProcessingStepKey
  context?: string
  source?: string
}

interface MeetingsSidebarProps {
  meetings: Meeting[]
  selectedId: string
  onSelect: (id: string) => void
  onRetry?: (id: string) => void
}

export function MeetingsSidebar({ meetings, selectedId, onSelect, onRetry }: MeetingsSidebarProps) {
  const [search, setSearch] = useState("")
  const { isRTL } = useLanguage()

  const filteredMeetings = meetings.filter((m) => m.title.toLowerCase().includes(search.toLowerCase()))

  const getStatusBadge = (meeting: Meeting) => {
    switch (meeting.status) {
      case "processing":
        return (
          <div className="flex flex-col items-end gap-1">
            <Badge className="text-xs bg-teal-600 text-white hover:bg-teal-600 gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {isRTL ? "בעיבוד" : "Processing"}
            </Badge>
            {meeting.currentStep && (
              <span className="text-[10px] text-muted-foreground">{getStageLabel(meeting.currentStep)}</span>
            )}
          </div>
        )
      case "draft":
        return (
          <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-600">
            <FileText className="w-3 h-3 mr-1" />
            {isRTL ? "טיוטה" : "Draft"}
          </Badge>
        )
      case "failed":
        return (
          <Badge variant="destructive" className="text-xs bg-red-500 text-white hover:bg-red-500 gap-1">
            <AlertCircle className="w-3 h-3" />
            {isRTL ? "נכשל" : "Failed"}
          </Badge>
        )
      default:
        return null
    }
  }

  const getStageLabel = (stage: ProcessingStepKey) => {
    const labels: Record<ProcessingStepKey, { he: string; en: string }> = {
      source_received: { he: "מקור התקבל", en: "Source received" },
      validation_cleanup: { he: "ולידציה וניקוי", en: "Validation & cleanup" },
      summary_generation: { he: "יצירת סיכום", en: "Summary generation" },
      action_item_extraction: { he: "חילוץ משימות", en: "Action item extraction" },
      entity_relationship_extraction: { he: "חילוץ ישויות", en: "Entity & relationship extraction" },
      saved_to_memory: { he: "נשמר בזיכרון", en: "Saved to memory" },
    }
    return isRTL ? labels[stage].he : labels[stage].en
  }

  return (
    <div className="w-72 flex-shrink-0 border-l border-border bg-sidebar flex flex-col">
      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search
            className={cn(
              "absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground",
              isRTL ? "right-3" : "left-3",
            )}
          />
          <Input
            placeholder={isRTL ? "חיפוש פגישות..." : "Search meetings..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn("bg-white", isRTL ? "pr-9" : "pl-9")}
          />
        </div>
      </div>

      {/* Meetings List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-2 space-y-1">
          {filteredMeetings.map((meeting) => (
            <button
              key={meeting.id}
              onClick={() => onSelect(meeting.id)}
              className={cn(
                "w-full p-3 rounded-lg transition-colors",
                isRTL ? "text-right" : "text-left",
                selectedId === meeting.id ? "bg-teal-100 border-2 border-teal-500" : "hover:bg-muted",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-medium text-sm text-foreground truncate flex-1">{meeting.title}</h4>
                {getStatusBadge(meeting)}
              </div>
              <div
                className={cn(
                  "flex items-center gap-3 mt-1.5 text-xs text-muted-foreground",
                  isRTL && "flex-row-reverse justify-end",
                )}
              >
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {meeting.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {meeting.duration}
                </span>
              </div>
              <div className={cn("flex items-center gap-1 mt-1.5 text-xs text-muted-foreground")}>
                <Users className="w-3 h-3" />
                <span>{meeting.participants.slice(0, 2).join(", ")}</span>
                {meeting.participants.length > 2 && <span>+{meeting.participants.length - 2}</span>}
              </div>

              {meeting.status === "failed" && onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs w-full justify-center gap-1 border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 bg-transparent"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRetry(meeting.id)
                  }}
                >
                  <RefreshCw className="w-3 h-3" />
                  {isRTL ? "נסה שוב" : "Retry"}
                </Button>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
