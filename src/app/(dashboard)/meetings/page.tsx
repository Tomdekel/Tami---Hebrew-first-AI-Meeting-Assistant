"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus, Loader2, Mic, Clock, CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSessions } from "@/hooks/use-session";
import type { SessionStatus } from "@/lib/types/database";

const statusConfig: Record<SessionStatus, { icon: React.ReactNode; label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { icon: <Clock className="h-3 w-3" />, label: "Pending", variant: "secondary" },
  recording: { icon: <Mic className="h-3 w-3 animate-pulse text-red-500" />, label: "Recording", variant: "destructive" },
  processing: { icon: <Loader2 className="h-3 w-3 animate-spin" />, label: "Processing", variant: "default" },
  completed: { icon: <CheckCircle2 className="h-3 w-3" />, label: "Completed", variant: "outline" },
  failed: { icon: <XCircle className="h-3 w-3" />, label: "Failed", variant: "destructive" },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MeetingsPage() {
  const t = useTranslations();
  const { sessions, isLoading, error, hasMore, loadMore } = useSessions();

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("nav.meetings")}</h1>
          <p className="text-muted-foreground mt-1">
            Your recorded meetings and transcriptions
          </p>
        </div>
        <Button asChild>
          <Link href="/meetings/new" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("nav.newMeeting")}
          </Link>
        </Button>
      </div>

      {/* Sessions List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-destructive">
            <AlertCircle className="h-5 w-5 me-2" />
            {error}
          </CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mic className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No meetings yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start recording a meeting or upload an existing audio file.
            </p>
            <Button asChild>
              <Link href="/meetings/new">
                <Plus className="h-4 w-4 me-2" />
                New Meeting
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const status = statusConfig[session.status];
            return (
              <Link key={session.id} href={`/meetings/${session.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {session.title || "Untitled Meeting"}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {formatDate(session.created_at)}
                        </CardDescription>
                      </div>
                      <Badge variant={status.variant} className="gap-1 shrink-0 ms-4">
                        {status.icon}
                        {status.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {formatDuration(session.duration_seconds)}
                      </span>
                      {session.detected_language && (
                        <Badge variant="outline" className="text-xs">
                          {session.detected_language === "he" ? "Hebrew" : "English"}
                        </Badge>
                      )}
                      {session.context && (
                        <span className="truncate max-w-[200px]">{session.context}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={loadMore}>
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
