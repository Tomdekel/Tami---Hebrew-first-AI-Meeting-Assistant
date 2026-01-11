"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Search,
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  TimerOff,
  Sparkles,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Session, SessionStatus } from "@/lib/types/database";

interface MeetingsSidebarProps {
  currentSessionId: string;
}

const statusIcons: Record<SessionStatus, React.ReactNode> = {
  pending: <Clock className="h-3 w-3" />,
  recording: <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />,
  processing: <Loader2 className="h-3 w-3 animate-spin" />,
  refining: <Sparkles className="h-3 w-3 animate-pulse" />,
  completed: <CheckCircle2 className="h-3 w-3" />,
  failed: <XCircle className="h-3 w-3" />,
  expired: <TimerOff className="h-3 w-3" />,
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function MeetingsSidebar({ currentSessionId }: MeetingsSidebarProps) {
  const t = useTranslations();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }
        const response = await fetch(`/api/sessions?${params}`);
        if (response.ok) {
          const data = await response.json();
          setSessions(data.sessions || []);
        }
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSessions();
  }, [debouncedSearch]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 shrink-0">
        <CardTitle className="text-sm font-medium">
          {t("nav.meetings")}
        </CardTitle>
        {/* Search */}
        <div className="relative mt-2">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("search.placeholder")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="ps-9 h-8 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 min-h-0">
        <ScrollArea className="h-[calc(100vh-280px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground px-4">
              {t("common.noResults")}
            </div>
          ) : (
            <div className="space-y-1 px-3 pb-3">
              {sessions.map((session) => {
                const isCurrent = session.id === currentSessionId;
                return (
                  <Link
                    key={session.id}
                    href={`/meetings/${session.id}`}
                    className={`block rounded-lg p-3 transition-colors ${
                      isCurrent
                        ? "bg-primary/10 border border-primary/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isCurrent ? "text-primary" : ""}`}>
                          {session.title || t("meeting.untitled")}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(session.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          session.status === "completed"
                            ? "outline"
                            : session.status === "failed" || session.status === "expired"
                              ? "destructive"
                              : "secondary"
                        }
                        className="shrink-0 h-5 px-1.5 text-[10px]"
                      >
                        {statusIcons[session.status]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      {session.detected_language && (
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                          {session.detected_language === "he" ? t("meeting.hebrew") : t("meeting.english")}
                        </Badge>
                      )}
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(session.duration_seconds)}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
