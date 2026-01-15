"use client"

import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import type { SessionWithRelations, Session, ActionItem } from "@/lib/types/database"

// UUID v4 regex pattern for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUUID(id: string | null): id is string {
  return !!id && UUID_REGEX.test(id)
}

// Query key factory for type-safe, consistent keys
export const sessionKeys = {
  all: ["sessions"] as const,
  lists: () => [...sessionKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) => [...sessionKeys.lists(), filters] as const,
  details: () => [...sessionKeys.all, "detail"] as const,
  detail: (id: string) => [...sessionKeys.details(), id] as const,
  speakers: (id: string) => [...sessionKeys.detail(id), "speakers"] as const,
  actionItems: (id: string) => [...sessionKeys.detail(id), "action-items"] as const,
  chat: (id: string) => [...sessionKeys.detail(id), "chat"] as const,
}

// Fetch single session with full relations (transcript, summary, tags)
export function useSessionQuery(sessionId: string | null) {
  return useQuery<SessionWithRelations | null>({
    queryKey: sessionKeys.detail(sessionId ?? ""),
    queryFn: async (): Promise<SessionWithRelations | null> => {
      if (!isValidUUID(sessionId)) {
        throw new Error("Invalid session ID format")
      }
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (!res.ok) {
        if (res.status === 404) return null
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to fetch session")
      }
      const data = await res.json()
      return data.session
    },
    enabled: isValidUUID(sessionId),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
}

// Hook to poll transcription status when session is processing
// This is critical for Hebrew (async) transcriptions that use RunPod
export function useTranscriptionStatusPolling(
  session: SessionWithRelations | null | undefined,
  pollInterval = 5000
) {
  const queryClient = useQueryClient()
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Only poll when session is processing
    const shouldPoll = session && (
      session.status === "processing" ||
      session.processing_state === "processing" ||
      (session.status === "pending" && session.audio_url)
    )

    if (!shouldPoll) {
      // Clear any existing polling
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/sessions/${session.id}/transcription-status`)
        if (response.ok) {
          const data = await response.json()
          // If status changed, invalidate the session query to refetch
          if (data.status !== session.status || data.completed) {
            queryClient.invalidateQueries({ queryKey: sessionKeys.detail(session.id) })
            queryClient.invalidateQueries({ queryKey: sessionKeys.lists() })
          }
        }
      } catch (err) {
        console.error("[polling] Error checking transcription status:", err)
      }
    }

    // Run immediately on mount
    checkStatus()

    // Set up polling interval
    pollingRef.current = setInterval(checkStatus, pollInterval)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [session?.id, session?.status, session?.processing_state, session?.audio_url, pollInterval, queryClient])
}

// Fetch sessions list for sidebar
export function useSessionsQuery(limit = 50) {
  return useQuery({
    queryKey: sessionKeys.list({ limit }),
    queryFn: async (): Promise<Session[]> => {
      const res = await fetch(`/api/sessions?limit=${limit}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to fetch sessions")
      }
      const data = await res.json()
      return data.sessions || []
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })
}

// Fetch speakers for a session
export function useSpeakersQuery(sessionId: string | null) {
  return useQuery({
    queryKey: sessionKeys.speakers(sessionId ?? ""),
    queryFn: async () => {
      if (!isValidUUID(sessionId)) {
        throw new Error("Invalid session ID format")
      }
      const res = await fetch(`/api/sessions/${sessionId}/speakers`)
      if (!res.ok) {
        if (res.status === 404) return []
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to fetch speakers")
      }
      const data = await res.json()
      return data.speakers || []
    },
    enabled: isValidUUID(sessionId),
    staleTime: 5 * 60 * 1000,
  })
}

// API response type for action items (different from DB type)
interface ActionItemApiResponse {
  id: string
  description: string
  assignee: string | null
  deadline: string | null
  completed: boolean
  createdAt: string
  updatedAt: string
  summaryId?: string
}

// Fetch action items for a session
export function useActionItemsQuery(sessionId: string | null) {
  return useQuery<ActionItem[]>({
    queryKey: sessionKeys.actionItems(sessionId ?? ""),
    queryFn: async (): Promise<ActionItem[]> => {
      if (!isValidUUID(sessionId)) {
        throw new Error("Invalid session ID format")
      }
      const res = await fetch(`/api/sessions/${sessionId}/action-items`)
      if (!res.ok) {
        if (res.status === 404) return []
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to fetch action items")
      }
      const data = await res.json()
      const items: ActionItemApiResponse[] = data.actionItems || []

      // Transform API response to database type
      return items.map((item) => ({
        id: item.id,
        summary_id: item.summaryId || "",
        description: item.description,
        assignee: item.assignee,
        deadline: item.deadline,
        completed: item.completed,
        created_at: item.createdAt,
        updated_at: item.updatedAt,
      }))
    },
    enabled: isValidUUID(sessionId),
    staleTime: 5 * 60 * 1000,
  })
}

// Hook to invalidate session queries (for refetch after mutations)
export function useInvalidateSessions() {
  const queryClient = useQueryClient()

  return {
    invalidateSession: (id: string) => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.detail(id) })
    },
    invalidateSessionsList: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() })
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.all })
    },
    // Remove a session from the list cache (after delete)
    removeSessionFromList: (id: string) => {
      queryClient.setQueriesData<Session[]>(
        { queryKey: sessionKeys.lists() },
        (old) => old?.filter((s) => s.id !== id)
      )
    },
    // Remove session detail from cache entirely (prevents 404 error after delete)
    removeSessionFromDetailCache: (id: string) => {
      queryClient.removeQueries({ queryKey: sessionKeys.detail(id) })
      // Also remove related queries (speakers, action items, chat)
      queryClient.removeQueries({ queryKey: sessionKeys.speakers(id) })
      queryClient.removeQueries({ queryKey: sessionKeys.actionItems(id) })
      queryClient.removeQueries({ queryKey: sessionKeys.chat(id) })
    },
  }
}
