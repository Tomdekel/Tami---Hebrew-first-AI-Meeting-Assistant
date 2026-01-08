"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface AdjacentSession {
  id: string;
  title: string | null;
  created_at: string;
}

interface MeetingNavigationProps {
  sessionId: string;
}

export function MeetingNavigation({ sessionId }: MeetingNavigationProps) {
  const t = useTranslations();
  const [previous, setPrevious] = useState<AdjacentSession | null>(null);
  const [next, setNext] = useState<AdjacentSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAdjacentMeetings = async () => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/adjacent`);
        if (response.ok) {
          const data = await response.json();
          setPrevious(data.previous);
          setNext(data.next);
        }
      } catch (err) {
        console.error("Failed to fetch adjacent meetings:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAdjacentMeetings();
  }, [sessionId]);

  const formatTitle = (session: AdjacentSession) => {
    return session.title || t("meeting.untitled");
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!previous && !next) {
    return null;
  }

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-2 py-3 px-3">
        {previous ? (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="flex-1 justify-start text-start h-auto py-2"
          >
            <Link href={`/meetings/${previous.id}`}>
              <ChevronLeft className="h-4 w-4 shrink-0 me-1 icon-flip-rtl" />
              <div className="min-w-0 overflow-hidden">
                <p className="text-xs text-muted-foreground">
                  {t("nav.previous") || "Previous"}
                </p>
                <p className="text-sm font-medium truncate">
                  {formatTitle(previous)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(previous.created_at)}
                </p>
              </div>
            </Link>
          </Button>
        ) : (
          <div className="flex-1" />
        )}

        {next ? (
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="flex-1 justify-end text-end h-auto py-2"
          >
            <Link href={`/meetings/${next.id}`}>
              <div className="min-w-0 overflow-hidden">
                <p className="text-xs text-muted-foreground">
                  {t("nav.next") || "Next"}
                </p>
                <p className="text-sm font-medium truncate">
                  {formatTitle(next)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(next.created_at)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 ms-1 icon-flip-rtl" />
            </Link>
          </Button>
        ) : (
          <div className="flex-1" />
        )}
      </CardContent>
    </Card>
  );
}
