"use client"

import { cn } from "@/lib/utils"
import { Check, Loader2 } from "lucide-react"
import { useLanguage } from "@/contexts/language-context"

export type ProcessingStepKey =
  | "source_received"
  | "validation_cleanup"
  | "summary_generation"
  | "action_item_extraction"
  | "entity_relationship_extraction"
  | "saved_to_memory"

export type ProcessingStepStatus = "pending" | "active" | "completed" | "failed"

interface ProcessingStep {
  step: ProcessingStepKey
  status: ProcessingStepStatus
}

interface ProcessingStepperProps {
  steps: ProcessingStep[]
  sourceLabel?: string
  isTranscriptSource?: boolean
  className?: string
}

// Simplified 3-step view for the UI
const displaySteps: Array<{ id: ProcessingStepKey; labelHe: string; labelEn: string }> = [
  { id: "source_received", labelHe: "הועלה", labelEn: "Uploaded" },
  { id: "validation_cleanup", labelHe: "מאמת", labelEn: "Validating" },
  { id: "summary_generation", labelHe: "מסכם", labelEn: "Summarizing" },
]

export function ProcessingStepper({ steps, className }: ProcessingStepperProps) {
  const { isRTL } = useLanguage()

  const statusMap = new Map(steps.map((step) => [step.step, step.status]))

  // Find the current active step among our display steps
  const currentStepId = displaySteps.find(ds => {
    const status = statusMap.get(ds.id)
    return status === "active" || status === "pending"
  })?.id || displaySteps[displaySteps.length - 1].id

  const currentIndex = displaySteps.findIndex((stage) => stage.id === currentStepId)
  const currentStepLabel = displaySteps[currentIndex]
  const ariaLabel = isRTL
    ? `מעבד: שלב ${currentIndex + 1} מתוך ${displaySteps.length} - ${currentStepLabel?.labelHe}`
    : `Processing: Step ${currentIndex + 1} of ${displaySteps.length} - ${currentStepLabel?.labelEn}`

  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {displaySteps.map((stage, index) => {
        const status = statusMap.get(stage.id) ?? "pending"
        const isComplete = status === "completed" || index < currentIndex
        const isCurrent = stage.id === currentStepId && status !== "completed"

        return (
          <div key={stage.id} className="flex items-center">
            <div className="flex items-center gap-1">
              <div
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center transition-colors",
                  isComplete && "bg-teal-600 text-white",
                  isCurrent && "bg-teal-100 text-teal-700",
                  !isComplete && !isCurrent && "bg-muted text-muted-foreground",
                )}
              >
                {isComplete ? (
                  <Check className="w-3 h-3" />
                ) : isCurrent ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <span className="text-[10px]">{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  isCurrent ? "text-teal-700 font-medium" : "text-muted-foreground",
                )}
              >
                {isRTL ? stage.labelHe : stage.labelEn}
              </span>
            </div>
            {index < displaySteps.length - 1 && (
              <div className={cn("h-px w-3 mx-1.5", index < currentIndex ? "bg-teal-600" : "bg-muted")} />
            )}
          </div>
        )
      })}
    </div>
  )
}
