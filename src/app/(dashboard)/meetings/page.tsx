"use client"

import { Suspense } from "react"
import { MeetingsPage } from "@/components/meetings-page"
import { MeetingSkeleton } from "@/components/meetings/meeting-skeleton"

export default function MeetingsRoutePage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-3.5rem)]"><div className="w-80 border-e border-border" /><div className="flex-1 p-6"><MeetingSkeleton /></div></div>}>
      <MeetingsPage />
    </Suspense>
  )
}
