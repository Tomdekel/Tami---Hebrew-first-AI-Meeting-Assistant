"use client"

import { cn } from "@/lib/utils"
import { Check, Loader2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

export type ProcessingStage = "uploading" | "transcribing" | "summarizing"

interface ProcessingStepperProps {
  currentStage: ProcessingStage
  source?: "audio" | "transcript" | "live" | "calendar"
  className?: string
}

const stages: { id: ProcessingStage; labelHe: string; labelEn: string }[] = [
  { id: "uploading", labelHe: "מעלה", labelEn: "Uploading" },
  { id: "transcribing", labelHe: "מתמלל", labelEn: "Transcribing" },
  { id: "summarizing", labelHe: "מסכם", labelEn: "Summarizing" },
]

export function ProcessingStepper({ currentStage, source, className }: ProcessingStepperProps) {
  const { isRTL } = useLanguage()

  const currentIndex = stages.findIndex((s) => s.id === currentStage)

  const getSourceLabel = () => {
    switch (source) {
      case "transcript":
        return isRTL ? "מקור: תמליל" : "Source: transcript"
      case "calendar":
        return isRTL ? "מקור: יומן" : "Source: calendar"
      case "live":
        return isRTL ? "מקור: הקלטה חיה" : "Source: live"
      default:
        return isRTL ? "מקור: קובץ שמע" : "Source: audio"
    }
  }

  return (
    <div className={cn("space-y-3", className)}>
      {source && <p className="text-xs text-muted-foreground">{getSourceLabel()}</p>}
      <div className="flex items-center gap-2">
        {stages.map((stage, index) => {
          const isComplete = index < currentIndex
          const isCurrent = index === currentIndex
          const isPending = index > currentIndex

          return (
            <div key={stage.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    isComplete && "bg-teal-600 text-white",
                    isCurrent && "bg-teal-100 text-teal-700 ring-2 ring-teal-600",
                    isPending && "bg-muted text-muted-foreground",
                  )}
                >
                  {isComplete ? (
                    <Check className="w-4 h-4" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs mt-2 text-center",
                    isCurrent ? "text-teal-700 font-medium" : "text-muted-foreground",
                  )}
                >
                  {isRTL ? stage.labelHe : stage.labelEn}
                </span>
              </div>
              {index < stages.length - 1 && (
                <div className={cn("h-0.5 w-8 mx-2", index < currentIndex ? "bg-teal-600" : "bg-muted")} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
