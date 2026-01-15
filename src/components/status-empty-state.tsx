"use client"

import { cn } from "@/lib/utils"
import { Loader2, FileText, AlertCircle, Clock, RefreshCw, MessageSquare, CheckCircle2, ListTodo, ScrollText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

type StatusType = "processing" | "draft" | "failed" | "empty" | "pending" | "empty_summary" | "empty_decisions" | "empty_tasks" | "empty_transcript"

interface StatusEmptyStateProps {
  status: StatusType
  section?: string
  onRetry?: () => void
  className?: string
}

export function StatusEmptyState({ status, section, onRetry, className }: StatusEmptyStateProps) {
  const { isRTL } = useLanguage()

  const content = {
    processing: {
      icon: <Loader2 className="w-6 h-6 text-teal-600 animate-spin" />,
      titleHe: "בעיבוד",
      titleEn: "Processing",
      descHe: "החלק הזה יופיע לאחר סיום העיבוד",
      descEn: "This section will appear once processing is complete",
    },
    draft: {
      icon: <FileText className="w-6 h-6 text-muted-foreground" />,
      titleHe: "טיוטה",
      titleEn: "Draft",
      descHe: "פגישה זו שמורה כטיוטה. העיבוד טרם החל",
      descEn: "This meeting is saved as a draft. Processing has not started",
    },
    failed: {
      icon: <AlertCircle className="w-6 h-6 text-red-500" />,
      titleHe: "העיבוד נכשל",
      titleEn: "Processing Failed",
      descHe: "ניתן לנסות שוב או לערוך את פרטי הפגישה",
      descEn: "You can retry or edit meeting details",
    },
    pending: {
      icon: <Clock className="w-6 h-6 text-amber-500" />,
      titleHe: "ממתין",
      titleEn: "Pending",
      descHe: "ממתין לסיום שלבים קודמים",
      descEn: "Waiting for previous steps to complete",
    },
    empty: {
      icon: <FileText className="w-6 h-6 text-muted-foreground" />,
      titleHe: "אין תוכן",
      titleEn: "No Content",
      descHe: `לא נמצא ${section || "תוכן"} בפגישה זו`,
      descEn: `No ${section || "content"} found in this meeting`,
    },
    empty_summary: {
      icon: <MessageSquare className="w-6 h-6 text-muted-foreground" />,
      titleHe: "אין סיכום",
      titleEn: "No Summary",
      descHe: "לא נוצר סיכום AI לפגישה זו",
      descEn: "No AI summary was generated for this meeting",
    },
    empty_decisions: {
      icon: <CheckCircle2 className="w-6 h-6 text-muted-foreground" />,
      titleHe: "אין החלטות",
      titleEn: "No Decisions",
      descHe: "לא זוהו החלטות בפגישה זו",
      descEn: "No decisions were identified in this meeting",
    },
    empty_tasks: {
      icon: <ListTodo className="w-6 h-6 text-muted-foreground" />,
      titleHe: "אין משימות",
      titleEn: "No Tasks",
      descHe: "לא זוהו משימות בפגישה זו",
      descEn: "No action items were identified in this meeting",
    },
    empty_transcript: {
      icon: <ScrollText className="w-6 h-6 text-muted-foreground" />,
      titleHe: "אין תמליל",
      titleEn: "No Transcript",
      descHe: "התמליל יופיע כאן לאחר סיום התמלול",
      descEn: "The transcript will appear here after transcription completes",
    },
  }

  const { icon, titleHe, titleEn, descHe, descEn } = content[status]

  return (
    <div className={cn("flex flex-col items-center justify-center py-4 px-4 text-center", className)}>
      {icon}
      <h4 className="mt-2 text-sm font-medium text-muted-foreground">{isRTL ? titleHe : titleEn}</h4>
      <p className="mt-1 text-xs text-muted-foreground/70 max-w-[200px]">{isRTL ? descHe : descEn}</p>
      {status === "failed" && onRetry && (
        <Button variant="outline" size="sm" className="mt-3 bg-transparent" onClick={onRetry}>
          <RefreshCw className={cn("w-3 h-3", isRTL ? "ml-2" : "mr-2")} />
          {isRTL ? "נסה שוב" : "Retry"}
        </Button>
      )}
    </div>
  )
}
