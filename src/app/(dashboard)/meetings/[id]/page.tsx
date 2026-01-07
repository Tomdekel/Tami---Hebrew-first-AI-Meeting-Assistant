"use client";

import { use, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Play,
  Pause,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Edit2,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSession, updateSession, deleteSession, startTranscription } from "@/hooks/use-session";
import type { TranscriptSegment } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  return formatTime(seconds);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Group consecutive segments by speaker
function groupSegmentsBySpeaker(segments: TranscriptSegment[]): TranscriptSegment[][] {
  const groups: TranscriptSegment[][] = [];
  let currentGroup: TranscriptSegment[] = [];
  let currentSpeaker: string | null = null;

  for (const segment of segments) {
    if (segment.speaker_name !== currentSpeaker) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
      }
      currentGroup = [segment];
      currentSpeaker = segment.speaker_name;
    } else {
      currentGroup.push(segment);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}

// Generate a consistent color for a speaker
function getSpeakerColor(speakerId: string): string {
  const colors = [
    "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
  ];

  // Simple hash to get consistent color
  let hash = 0;
  for (let i = 0; i < speakerId.length; i++) {
    hash = speakerId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function SessionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { session, isLoading, error, refetch } = useSession(id, { pollWhileProcessing: true });

  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleStartTranscription = async () => {
    setIsTranscribing(true);
    try {
      await startTranscription(id);
      toast.success("Transcription started");
      refetch();
    } catch (err) {
      toast.error("Failed to start transcription", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSaveTitle = async () => {
    try {
      await updateSession(id, { title: editTitle });
      toast.success("Title updated");
      setIsEditing(false);
      refetch();
    } catch (err) {
      toast.error("Failed to update title", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteSession(id);
      toast.success("Meeting deleted");
      router.push("/meetings");
    } catch (err) {
      toast.error("Failed to delete meeting", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 icon-flip-rtl" />
          Back to Meetings
        </Link>
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-destructive">
            <AlertCircle className="h-5 w-5 me-2" />
            {error || "Session not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const segmentGroups = session.transcript?.segments
    ? groupSegmentsBySpeaker(session.transcript.segments)
    : [];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 icon-flip-rtl" />
          Back to Meetings
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Meeting title"
                  className="text-2xl font-bold h-auto py-1"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveTitle}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                  {session.title || "Untitled Meeting"}
                </h1>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => {
                    setEditTitle(session.title || "");
                    setIsEditing(true);
                  }}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="text-muted-foreground mt-1">
              {formatDate(session.created_at)}
            </p>
          </div>

          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Meeting</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete this meeting? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Status and metadata */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Badge
            variant={
              session.status === "completed"
                ? "outline"
                : session.status === "failed"
                  ? "destructive"
                  : "secondary"
            }
          >
            {session.status === "processing" && (
              <Loader2 className="h-3 w-3 me-1 animate-spin" />
            )}
            {session.status === "completed" && (
              <CheckCircle2 className="h-3 w-3 me-1" />
            )}
            {session.status}
          </Badge>

          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatDuration(session.duration_seconds)}
          </span>

          {session.detected_language && (
            <Badge variant="outline">
              {session.detected_language === "he" ? "Hebrew" : "English"}
            </Badge>
          )}
        </div>
      </div>

      <Separator className="my-6" />

      {/* Audio Player */}
      {session.audio_url && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Audio</CardTitle>
          </CardHeader>
          <CardContent>
            <audio
              controls
              className="w-full"
              src={session.audio_url}
            >
              Your browser does not support the audio element.
            </audio>
          </CardContent>
        </Card>
      )}

      {/* Transcription Status / Start Button */}
      {session.status === "pending" && session.audio_url && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <h3 className="font-medium">Ready to transcribe</h3>
              <p className="text-sm text-muted-foreground">
                Click the button to start transcription
              </p>
            </div>
            <Button onClick={handleStartTranscription} disabled={isTranscribing}>
              {isTranscribing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              Start Transcription
            </Button>
          </CardContent>
        </Card>
      )}

      {session.status === "processing" && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="font-medium">Transcribing...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This may take a few minutes depending on the audio length
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {session.status === "failed" && (
        <Card className="mb-6 border-destructive">
          <CardContent className="flex items-center justify-between py-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <div>
                <h3 className="font-medium text-destructive">Transcription failed</h3>
                <p className="text-sm text-muted-foreground">
                  An error occurred during transcription
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleStartTranscription} disabled={isTranscribing}>
              <RefreshCw className="h-4 w-4 me-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Transcript */}
      {session.transcript && (
        <Card>
          <CardHeader>
            <CardTitle>{t("meeting.transcript")}</CardTitle>
            <CardDescription>
              {session.transcript.segments?.length || 0} segments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {segmentGroups.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No transcript segments available
              </p>
            ) : (
              <div className="space-y-6">
                {segmentGroups.map((group, groupIndex) => {
                  const firstSegment = group[0];
                  const lastSegment = group[group.length - 1];
                  const speakerColor = getSpeakerColor(firstSegment.speaker_id);

                  return (
                    <div key={groupIndex} className="group">
                      {/* Speaker header */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${speakerColor}`}>
                          <User className="h-3 w-3" />
                          {firstSegment.speaker_name || firstSegment.speaker_id}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(firstSegment.start_time)} - {formatTime(lastSegment.end_time)}
                        </span>
                      </div>

                      {/* Combined text for this speaker group */}
                      <p className="text-foreground leading-relaxed ps-4 border-s-2 border-muted">
                        {group.map((seg) => seg.text).join(" ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
