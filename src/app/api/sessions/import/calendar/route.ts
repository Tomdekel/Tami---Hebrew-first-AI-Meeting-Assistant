import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { unauthorized, badRequest, internalError } from "@/lib/api/errors"
import { getDefaultProcessingSteps } from "@/lib/pipelines/meeting-ingestion/processing-state"
import type { SourceType, IngestionConfidence } from "@/lib/types/database"

interface CalendarImportPayload {
  provider: string
  eventId: string
  title: string
  startTime?: string
  endTime?: string
  timezone?: string
  meetingUrl?: string
  attendees?: Array<{ email: string; displayName?: string }>
  platform?: string
  organizerEmail?: string
  raw?: Record<string, unknown>
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return unauthorized()
  }

  let payload: CalendarImportPayload | null = null
  try {
    payload = (await request.json()) as CalendarImportPayload
  } catch {
    return badRequest("Invalid JSON payload")
  }

  if (!payload?.provider || !payload?.eventId || !payload?.title) {
    return badRequest("provider, eventId, and title are required")
  }

  try {
    const sourceMetadata = {
      provider: payload.provider,
      event_id: payload.eventId,
      meeting_url: payload.meetingUrl || null,
      platform: payload.platform || null,
      organizer: payload.organizerEmail || null,
      attendees: payload.attendees || [],
      start_time: payload.startTime || null,
      end_time: payload.endTime || null,
      timezone: payload.timezone || null,
      raw: payload.raw || {},
    }

    const sourceType: SourceType = "imported"
    const ingestionConfidence: IngestionConfidence = "low"

    const { data: session, error } = await supabase
      .from("sessions")
      .insert({
        user_id: user.id,
        title: payload.title,
        context: null,
        status: "recording",
        audio_url: null,
        detected_language: null,
        duration_seconds: null,
        source_type: sourceType,
        source_metadata: sourceMetadata,
        has_timestamps: false,
        ingestion_confidence: ingestionConfidence,
        processing_state: "draft",
        processing_steps: getDefaultProcessingSteps(),
        current_step: null,
      })
      .select()
      .single()

    if (error || !session) {
      return internalError("Failed to create calendar draft", { dbError: error?.message })
    }

    return NextResponse.json({ sessionId: session.id })
  } catch (error) {
    console.error("Calendar import failed:", error)
    return internalError("Failed to create calendar draft")
  }
}
