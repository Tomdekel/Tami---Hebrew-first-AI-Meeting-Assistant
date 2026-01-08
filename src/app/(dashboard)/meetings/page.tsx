"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Plus, Loader2, Mic, Clock, CheckCircle2, AlertCircle, XCircle, Sparkles, Tag as TagIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSessions } from "@/hooks/use-session";
import type { SessionStatus, Tag } from "@/lib/types/database";

const statusIcons: Record<SessionStatus, { icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { icon: <Clock className="h-3 w-3" />, variant: "secondary" },
  recording: { icon: <Mic className="h-3 w-3 animate-pulse text-red-500" />, variant: "destructive" },
  processing: { icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "default" },
  refining: { icon: <Sparkles className="h-3 w-3 animate-pulse" />, variant: "default" },
  completed: { icon: <CheckCircle2 className="h-3 w-3" />, variant: "outline" },
  failed: { icon: <XCircle className="h-3 w-3" />, variant: "destructive" },
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
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState<string | undefined>();
  const [tagsLoading, setTagsLoading] = useState(true);

  const { sessions, isLoading, error, hasMore, loadMore } = useSessions({
    tagId: selectedTagId,
  });

  // Fetch tags on mount
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await fetch("/api/tags");
        if (response.ok) {
          const data = await response.json();
          setTags(data.tags || []);
        }
      } catch (error) {
        console.error("Failed to fetch tags:", error);
      } finally {
        setTagsLoading(false);
      }
    };
    fetchTags();
  }, []);

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("nav.meetings")}</h1>
          <p className="text-muted-foreground mt-1">
            {t("meeting.yourMeetings")}
          </p>
        </div>
        <Button asChild>
          <Link href="/meetings/new" className="gap-2">
            <Plus className="h-4 w-4" />
            {t("nav.newMeeting")}
          </Link>
        </Button>
      </div>

      {/* Tag Filter */}
      {!tagsLoading && tags.length > 0 && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <TagIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <button
            onClick={() => setSelectedTagId(undefined)}
            className={`px-3 py-1 rounded-full text-sm transition-colors ${
              !selectedTagId
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {t("common.all") || "All"}
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setSelectedTagId(tag.id === selectedTagId ? undefined : tag.id)}
              className={`px-3 py-1 rounded-full text-sm transition-colors flex items-center gap-1 ${
                selectedTagId === tag.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
              style={
                selectedTagId !== tag.id && tag.color
                  ? { borderLeft: `3px solid ${tag.color}` }
                  : undefined
              }
            >
              {tag.name}
              {selectedTagId === tag.id && (
                <X className="h-3 w-3 ms-1" />
              )}
            </button>
          ))}
        </div>
      )}

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
            <h3 className="text-lg font-medium mb-2">{t("meeting.noMeetingsYet")}</h3>
            <p className="text-muted-foreground text-center mb-4">
              {t("meeting.noMeetingsDesc")}
            </p>
            <Button asChild>
              <Link href="/meetings/new">
                <Plus className="h-4 w-4 me-2" />
                {t("nav.newMeeting")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const status = statusIcons[session.status];
            return (
              <Link key={session.id} href={`/meetings/${session.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg truncate">
                          {session.title || t("meeting.untitled")}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {formatDate(session.created_at)}
                        </CardDescription>
                      </div>
                      <Badge variant={status.variant} className="gap-1 shrink-0 ms-4">
                        {status.icon}
                        {t(`meeting.${session.status}`)}
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
                          {session.detected_language === "he" ? t("meeting.hebrew") : t("meeting.english")}
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
                {t("meeting.loadMore")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
