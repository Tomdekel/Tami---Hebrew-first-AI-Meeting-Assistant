"use client"

import { useState } from "react"
import { X, Users, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/contexts/language-context"

interface SpeakerNamingBannerProps {
  unnamedCount: number
  totalCount: number
  onAssignClick: () => void
  className?: string
}

export function SpeakerNamingBanner({ unnamedCount, totalCount, onAssignClick, className }: SpeakerNamingBannerProps) {
  const { isRTL } = useLanguage()
  const { toast } = useToast()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || unnamedCount === 0) return null

  const allNamed = unnamedCount === 0
  const someNamed = unnamedCount < totalCount && unnamedCount > 0

  const handleAssignClick = () => {
    onAssignClick()
    // Toast will be triggered from the parent when a name is actually assigned
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border",
        allNamed ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200",
        className,
      )}
    >
      <div
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
          allNamed ? "bg-green-100" : "bg-amber-100",
        )}
      >
        {allNamed ? <Sparkles className="w-4 h-4 text-green-600" /> : <Users className="w-4 h-4 text-amber-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", allNamed ? "text-green-800" : "text-amber-800")}>
          {allNamed
            ? isRTL
              ? "כל הדוברים זוהו!"
              : "All speakers identified!"
            : someNamed
              ? isRTL
                ? `${unnamedCount} דוברים עדיין לא זוהו`
                : `${unnamedCount} speakers still unnamed`
              : isRTL
                ? "הקצאת שמות לדוברים מאפשרת חיפוש לפי אנשים ותובנות טובות יותר"
                : "Assigning speaker names enables search by people and better insights"}
        </p>
      </div>
      {!allNamed && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAssignClick}
          className="flex-shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100 bg-transparent"
        >
          {isRTL ? "הקצה שמות" : "Assign Names"}
        </Button>
      )}
      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 flex-shrink-0" onClick={() => setDismissed(true)}>
        <X className="w-4 h-4" />
      </Button>
    </div>
  )
}

export function showSpeakerNamedToast(toast: ReturnType<typeof useToast>["toast"], isRTL: boolean) {
  toast({
    title: isRTL ? "דובר זוהה!" : "Speaker identified!",
    description: isRTL ? "חיפוש לפי הדובר זמין כעת" : "Search by this speaker is now available",
  })
}
