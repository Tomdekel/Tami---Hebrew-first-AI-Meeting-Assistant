"use client";

import { useState, useEffect, useCallback } from "react";
import type { Session, SessionWithRelations } from "@/lib/types/database";

interface UseSessionOptions {
  pollInterval?: number;
  pollWhileProcessing?: boolean;
}

interface UseSessionReturn {
  session: SessionWithRelations | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSession(
  sessionId: string | null,
  options: UseSessionOptions = {}
): UseSessionReturn {
  const { pollInterval = 3000, pollWhileProcessing = true } = options;

  const [session, setSession] = useState<SessionWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to fetch session");
      }

      const data = await response.json();
      setSession(data.session);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch session");
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    fetchSession();
  }, [fetchSession]);

  // Poll while processing
  useEffect(() => {
    if (!pollWhileProcessing || !session || session.status !== "processing") {
      return;
    }

    const interval = setInterval(fetchSession, pollInterval);
    return () => clearInterval(interval);
  }, [session?.status, pollWhileProcessing, pollInterval, fetchSession]);

  return {
    session,
    isLoading,
    error,
    refetch: fetchSession,
  };
}

interface UseSessionsOptions {
  limit?: number;
  status?: string;
}

interface UseSessionsReturn {
  sessions: Session[];
  total: number;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useSessions(options: UseSessionsOptions = {}): UseSessionsReturn {
  const { limit = 20, status } = options;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(
    async (reset = true) => {
      try {
        const currentOffset = reset ? 0 : offset;
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: currentOffset.toString(),
        });

        if (status) {
          params.set("status", status);
        }

        const response = await fetch(`/api/sessions?${params}`);

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to fetch sessions");
        }

        const data = await response.json();

        if (reset) {
          setSessions(data.sessions);
        } else {
          setSessions((prev) => [...prev, ...data.sessions]);
        }

        setTotal(data.total);
        setOffset(currentOffset + data.sessions.length);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch sessions");
      } finally {
        setIsLoading(false);
      }
    },
    [limit, status, offset]
  );

  // Initial fetch
  useEffect(() => {
    setIsLoading(true);
    setOffset(0);
    fetchSessions(true);
  }, [limit, status]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => {
    if (sessions.length >= total) return;
    await fetchSessions(false);
  }, [sessions.length, total, fetchSessions]);

  return {
    sessions,
    total,
    isLoading,
    error,
    refetch: () => fetchSessions(true),
    loadMore,
    hasMore: sessions.length < total,
  };
}

interface CreateSessionData {
  title?: string;
  context?: string;
  audio_url?: string;
  detected_language?: string;
  duration_seconds?: number;
}

export async function createSession(data: CreateSessionData): Promise<Session> {
  const response = await fetch("/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to create session");
  }

  const result = await response.json();
  return result.session;
}

export async function updateSession(
  sessionId: string,
  data: Partial<CreateSessionData & { status: string }>
): Promise<Session> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to update session");
  }

  const result = await response.json();
  return result.session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${sessionId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to delete session");
  }
}

export async function startTranscription(sessionId: string): Promise<void> {
  const response = await fetch(`/api/sessions/${sessionId}/transcribe`, {
    method: "POST",
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to start transcription");
  }
}
