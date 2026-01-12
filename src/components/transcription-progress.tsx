"use client"

import { Check, X, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

type TranscriptionStatus = "pending" | "processing" | "completed" | "failed"

interface TranscriptionProgressProps {
  status: TranscriptionStatus
  className?: string
}

const steps = [
  { id: 1, label: "מעלה", key: "uploading" },
  { id: 2, label: "מתמלל", key: "transcribing" },
  { id: 3, label: "מסכם", key: "summarizing" },
  { id: 4, label: "הושלם", key: "completed" },
]

type StepState = "completed" | "active" | "failed" | "inactive"

function getStepState(stepId: number, status: TranscriptionStatus): StepState {
  if (status === "completed") {
    return "completed"
  }

  if (status === "failed") {
    // Show error on step 2 (transcribing) as it's most likely to fail
    if (stepId === 2) {
      return "failed"
    }
    if (stepId === 1) {
      return "completed" // Upload succeeded if we got to transcribing
    }
    return "inactive"
  }

  if (status === "pending" && stepId === 1) {
    return "active"
  }

  if (status === "processing") {
    if (stepId === 1) {
      return "completed" // Upload completed
    }
    if (stepId === 2) {
      return "active"
    }
  }

  return "inactive"
}

export function TranscriptionProgress({
  status,
  className,
}: TranscriptionProgressProps) {
  const renderStepIcon = (stepId: number) => {
    const state = getStepState(stepId, status)

    if (state === "completed") {
      return <Check className="h-3 w-3" />
    }

    if (state === "failed") {
      return <X className="h-3 w-3" />
    }

    if (state === "active") {
      return <Loader2 className="h-3 w-3 animate-spin" />
    }

    return <span className="text-[10px]">{stepId}</span>
  }

  const getStepClasses = (stepId: number) => {
    const state = getStepState(stepId, status)

    const baseClasses =
      "relative flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium transition-all duration-200"

    switch (state) {
      case "completed":
        return cn(baseClasses, "bg-teal-500 text-white")
      case "active":
        return cn(baseClasses, "bg-teal-600 text-white")
      case "failed":
        return cn(baseClasses, "bg-red-500 text-white")
      default:
        return cn(baseClasses, "bg-gray-200 text-gray-500 dark:bg-gray-700")
    }
  }

  const getConnectorClasses = (stepId: number) => {
    const state = getStepState(stepId, status)
    const nextState = stepId < 4 ? getStepState(stepId + 1, status) : "inactive"

    // Connector is filled if this step is completed or next step is active/completed
    if (
      state === "completed" ||
      nextState === "active" ||
      nextState === "completed"
    ) {
      return "bg-teal-500"
    }

    if (state === "active") {
      return "bg-teal-300"
    }

    return "bg-gray-200 dark:bg-gray-700"
  }

  return (
    <div className={cn("flex items-center justify-center", className)} dir="rtl">
      <div className="flex items-center gap-1">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div className={getStepClasses(step.id)}>
                {renderStepIcon(step.id)}
              </div>
              <span className="mt-0.5 text-[10px] text-muted-foreground whitespace-nowrap">
                {step.label}
              </span>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "mx-1 h-0.5 w-6 transition-colors duration-200",
                  getConnectorClasses(step.id)
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
