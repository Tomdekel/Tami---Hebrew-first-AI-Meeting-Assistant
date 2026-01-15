"use client"

import { cn } from "@/lib/utils"
import { Loader2, FileText, AlertCircle, Clock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/contexts/language-context"

type StatusType = "processing" | "draft" | "failed" | "empty" | "pending"

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
      icon: <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />,
      titleHe: "בעיבוד",
      titleEn: "Processing",
      descHe: `${section ? section + " יופיע" : "התוכן יופיע"} לאחר סיום העיבוד`,
      descEn: `${section ? section + " will appear" : "Content will appear"} once processing is complete`,
    },
    draft: {
      icon: <FileText className="w-8 h-8 text-muted-foreground" />,
      titleHe: "טיוטה",
      titleEn: "Draft",
      descHe: "פגישה זו שמורה כטיוטה. העיבוד טרם החל",
      descEn: "This meeting is saved as a draft. Processing has not started",
    },
    failed: {
      icon: <AlertCircle className="w-8 h-8 text-red-500" />,
      titleHe: "העיבוד נכשל",
      titleEn: "Processing Failed",
      descHe: "ניתן לנסות שוב או לערוך את פרטי הפגישה",
      descEn: "You can retry or edit meeting details",
    },
    pending: {
      icon: <Clock className="w-8 h-8 text-amber-500" />,
      titleHe: "ממתין",
      titleEn: "Pending",
      descHe: "ממתין לסיום שלבים קודמים",
      descEn: "Waiting for previous steps to complete",
    },
    empty: {
      icon: <FileText className="w-8 h-8 text-muted-foreground" />,
      titleHe: "אין תוכן",
      titleEn: "No Content",
      descHe: `לא נמצא ${section || "תוכן"} בפגישה זו`,
      descEn: `No ${section || "content"} found in this meeting`,
    },
  }

  const { icon, titleHe, titleEn, descHe, descEn } = content[status]

  return (
    <div className={cn("flex flex-col items-center justify-center py-8 px-4 text-center", className)}>
      {icon}
      <h4 className="mt-3 font-medium text-foreground">{isRTL ? titleHe : titleEn}</h4>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">{isRTL ? descHe : descEn}</p>
      {status === "failed" && onRetry && (
        <Button variant="outline" size="sm" className="mt-4 bg-transparent" onClick={onRetry}>
          <RefreshCw className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
          {isRTL ? "נסה שוב" : "Retry"}
        </Button>
      )}
    </div>
  )
}
