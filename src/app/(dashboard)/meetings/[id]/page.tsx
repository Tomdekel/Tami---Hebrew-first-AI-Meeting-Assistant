"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import { MeetingsPage } from "@/components/meetings-page"
import { MeetingSkeleton } from "@/components/meetings/meeting-skeleton"

function MeetingDetailContent() {
  const params = useParams<{ id: string }>()
  return <MeetingsPage initialMeetingId={params.id} />
}

export default function MeetingDetailPage() {
  return (
    <Suspense fallback={<div className="flex h-[calc(100vh-3.5rem)]"><div className="w-80 border-e border-border" /><div className="flex-1 p-6"><MeetingSkeleton /></div></div>}>
      <MeetingDetailContent />
    </Suspense>
  )
}
