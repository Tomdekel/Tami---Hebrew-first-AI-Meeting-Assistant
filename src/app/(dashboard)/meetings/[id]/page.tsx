"use client";

import { use, useState, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  Edit2,
  Sparkles,
  FileText,
  Tags,
  Plus,
  X,
  MoreVertical,
  RotateCcw,
  FileDown,
  Brain,
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useSession, updateSession, deleteSession, startTranscription } from "@/hooks/use-session";
import { AudioPlayer } from "@/components/audio-player";
import { TranscriptViewer } from "@/components/transcript-viewer";
import { SpeakersPanel } from "@/components/speakers-panel";
import { SummaryPanel } from "@/components/summary-panel";
import { ChatPanel } from "@/components/chat-panel";
import { MeetingNavigation } from "@/components/meeting-navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  source: string;
  isVisible: boolean;
}

interface Speaker {
  speakerId: string;
  speakerName: string;
  segmentCount: number;
}

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
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SessionDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { session, isLoading, error, refetch } = useSession(id, { pollWhileProcessing: true });

  // Basic states
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);

  // Tags state
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  // Speakers state
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [speakersLoaded, setSpeakersLoaded] = useState(false);

  // Reprocess/export state
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Load tags
  const loadTags = useCallback(async () => {
    if (tagsLoaded) return;
    try {
      const [sessionTagsRes, allTagsRes] = await Promise.all([
        fetch(`/api/sessions/${id}/tags`),
        fetch(`/api/tags`),
      ]);
      if (sessionTagsRes.ok) {
        const data = await sessionTagsRes.json();
        setTags(data.tags || []);
      }
      if (allTagsRes.ok) {
        const data = await allTagsRes.json();
        setAllTags(data.tags || []);
      }
      setTagsLoaded(true);
    } catch (err) {
      console.error("Failed to load tags:", err);
    }
  }, [id, tagsLoaded]);

  // Load speakers
  const loadSpeakers = useCallback(async () => {
    if (speakersLoaded) return;
    try {
      const res = await fetch(`/api/sessions/${id}/speakers`);
      if (res.ok) {
        const data = await res.json();
        setSpeakers(data.speakers || []);
      }
      setSpeakersLoaded(true);
    } catch (err) {
      console.error("Failed to load speakers:", err);
    }
  }, [id, speakersLoaded]);

  // Load on mount
  useEffect(() => {
    loadTags();
  }, [loadTags]);

  // Load speakers when transcript is ready
  useEffect(() => {
    if (session?.transcript?.segments?.length) {
      loadSpeakers();
    }
  }, [session?.transcript?.segments?.length, loadSpeakers]);

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

  const handleAddTag = async (tagId: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagId }),
      });

      if (!response.ok) throw new Error("Failed to add tag");

      const addedTag = allTags.find((t) => t.id === tagId);
      if (addedTag) {
        setTags((prev) => [...prev, addedTag]);
      }
      toast.success("Tag added");
    } catch (err) {
      toast.error("Failed to add tag");
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}/tags?tagId=${tagId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to remove tag");

      setTags((prev) => prev.filter((t) => t.id !== tagId));
      toast.success("Tag removed");
    } catch (err) {
      toast.error("Failed to remove tag");
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    setIsAddingTag(true);

    try {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName.trim() }),
      });

      if (!response.ok) throw new Error("Failed to create tag");

      const data = await response.json();
      setAllTags((prev) => [...prev, data.tag]);
      await handleAddTag(data.tag.id);
      setNewTagName("");
      setTagDialogOpen(false);
    } catch (err) {
      toast.error("Failed to create tag");
    } finally {
      setIsAddingTag(false);
    }
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      const response = await fetch(`/api/sessions/${id}/reprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: ["summary", "entities", "embeddings"] }),
      });

      if (!response.ok) throw new Error("Failed to reprocess");

      const data = await response.json();
      toast.success(data.message || "Reprocessing complete");
      refetch();
    } catch (err) {
      toast.error("Failed to reprocess");
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleExport = async (format: "html" | "markdown", includeTranscript: boolean = false) => {
    setIsExporting(true);
    try {
      const url = `/api/sessions/${id}/export?format=${format}&includeTranscript=${includeTranscript}`;
      const response = await fetch(url);

      if (!response.ok) throw new Error("Failed to export");

      const blob = await response.blob();
      const filename = response.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "")
        || `meeting.${format === "html" ? "html" : "md"}`;

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast.success(t("export.success"));
    } catch (err) {
      toast.error(t("export.failed"));
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 icon-flip-rtl" />
          {t("meeting.backToMeetings")}
        </Link>
        <Card>
          <CardContent className="flex items-center justify-center py-12 text-destructive">
            <AlertCircle className="h-5 w-5 me-2" />
            {error || t("meeting.sessionNotFound")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasTranscript = session.transcript && session.transcript.segments?.length > 0;

  // Transform segments for TranscriptViewer
  const transcriptSegments = session.transcript?.segments?.map((seg) => ({
    speakerId: seg.speaker_id,
    speakerName: seg.speaker_name || seg.speaker_id,
    text: seg.text,
    startTime: seg.start_time,
    endTime: seg.end_time,
    segmentOrder: seg.segment_order,
    isDeleted: seg.is_deleted,
  })) || [];

  const availableTagsToAdd = allTags.filter(
    (t) => !tags.some((existing) => existing.id === t.id)
  );

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 icon-flip-rtl" />
          {t("meeting.backToMeetings")}
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t("meeting.meetingTitle")}
                  className="text-2xl font-bold h-auto py-1"
                  autoFocus
                />
                <Button size="sm" onClick={handleSaveTitle}>
                  {t("common.save")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>
                  {t("common.cancel")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{session.title || t("meeting.untitled")}</h1>
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
            <p className="text-muted-foreground mt-1">{formatDate(session.created_at)}</p>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => handleExport("html", false)}
                  disabled={isExporting}
                >
                  <FileDown className="h-4 w-4 me-2" />
                  {t("export.summaryOnly")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport("html", true)}
                  disabled={isExporting}
                >
                  <FileText className="h-4 w-4 me-2" />
                  {t("export.withTranscript")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleReprocess} disabled={isReprocessing}>
                  <RotateCcw className="h-4 w-4 me-2" />
                  {t("meeting.reprocess")}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/entities?session=${id}`}>
                    <Brain className="h-4 w-4 me-2" />
                    {t("meeting.insights")}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4 me-2" />
                  {t("common.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
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
            {(session.status === "processing" || session.status === "refining") && <Loader2 className="h-3 w-3 me-1 animate-spin" />}
            {session.status === "completed" && <CheckCircle2 className="h-3 w-3 me-1" />}
            {session.status === "completed" && t("meeting.completed")}
            {session.status === "failed" && t("meeting.failed")}
            {session.status === "processing" && t("meeting.processing")}
            {session.status === "refining" && t("meeting.refining")}
            {session.status === "pending" && t("meeting.pending")}
          </Badge>

          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {formatDuration(session.duration_seconds)}
          </span>

          {session.detected_language && (
            <Badge variant="outline">
              {session.detected_language === "he" ? t("meeting.hebrew") : t("meeting.english")}
            </Badge>
          )}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <Tags className="h-4 w-4 text-muted-foreground" />
          {tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="secondary"
              className="gap-1"
              style={{ borderLeftColor: tag.color, borderLeftWidth: 3 }}
            >
              {tag.name}
              <button
                onClick={() => handleRemoveTag(tag.id)}
                className="ms-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 px-2">
                <Plus className="h-3 w-3 me-1" />
                {t("meeting.addTag")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {availableTagsToAdd.length > 0 ? (
                availableTagsToAdd.map((tag) => (
                  <DropdownMenuItem key={tag.id} onClick={() => handleAddTag(tag.id)}>
                    <div
                      className="h-3 w-3 rounded-full me-2"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </DropdownMenuItem>
                ))
              ) : (
                <DropdownMenuItem disabled>{t("meeting.noTagsAvailable")}</DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setTagDialogOpen(true)}>
                <Plus className="h-4 w-4 me-2" />
                {t("meeting.createNewTag")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Create Tag Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("meeting.createNewTag")}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="tagName">{t("meeting.tagName")}</Label>
            <Input
              id="tagName"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder={t("meeting.enterTagName")}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleCreateTag} disabled={isAddingTag || !newTagName.trim()}>
              {isAddingTag && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("meeting.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("meeting.deleteMeeting")}</DialogTitle>
            <DialogDescription>
              {t("meeting.deleteConfirm")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Separator className="my-6" />

      {/* Audio Player */}
      {session.audio_url && (
        <div className="mb-6">
          <AudioPlayer
            src={session.audio_url}
            onTimeUpdate={setAudioCurrentTime}
          />
        </div>
      )}

      {/* Processing States */}
      {session.status === "pending" && session.audio_url && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-between py-6">
            <div>
              <h3 className="font-medium">{t("meeting.readyToTranscribe")}</h3>
              <p className="text-sm text-muted-foreground">
                {t("meeting.clickToStartTranscription")}
              </p>
            </div>
            <Button onClick={handleStartTranscription} disabled={isTranscribing}>
              {isTranscribing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              {t("meeting.startTranscription")}
            </Button>
          </CardContent>
        </Card>
      )}

      {session.status === "processing" && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <h3 className="font-medium">{t("meeting.transcribing")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("meeting.transcribingDesc")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {session.status === "refining" && (
        <Card className="mb-6">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Sparkles className="h-12 w-12 animate-pulse text-primary mx-auto mb-4" />
              <h3 className="font-medium">{t("meeting.refining")}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {t("meeting.refiningDesc")}
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
                <h3 className="font-medium text-destructive">{t("meeting.transcriptionFailed")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("meeting.transcriptionError")}
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={handleStartTranscription} disabled={isTranscribing}>
              <RefreshCw className="h-4 w-4 me-2" />
              {t("common.retry")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Main Content: Two-Column Layout */}
      {(hasTranscript || session.status === "processing" || session.status === "refining") && (
        <div className="flex gap-6 flex-col-reverse lg:flex-row">
          {/* Sidebar - On the left for RTL */}
          <aside className="lg:w-80 shrink-0 space-y-4">
            {/* Speakers */}
            <SpeakersPanel
              sessionId={id}
              speakers={speakers}
              onSpeakersChange={setSpeakers}
              onRefresh={() => {
                setSpeakersLoaded(false);
                loadSpeakers();
                refetch();
              }}
              isProcessing={session.status === "processing" || session.status === "refining"}
            />

            {/* Summary */}
            <SummaryPanel
              sessionId={id}
              summary={session.summary || null}
              onRefresh={refetch}
              isProcessing={session.status === "processing" || session.status === "refining"}
            />

            {/* Chat */}
            <ChatPanel
              sessionId={id}
              isProcessing={session.status === "processing" || session.status === "refining"}
            />

            {/* Navigation */}
            <MeetingNavigation sessionId={id} />
          </aside>

          {/* Main Content - Transcript */}
          <div className="flex-1 min-w-0">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {t("meeting.transcript")}
                    </CardTitle>
                    <CardDescription>
                      {hasTranscript
                        ? `${transcriptSegments.filter(s => !s.isDeleted).length} ${t("meeting.segments")} • ${t("meeting.clickToJump")}`
                        : t("meeting.transcriptWillAppear") || "התמלול יופיע כאן לאחר סיום העיבוד"
                      }
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {hasTranscript ? (
                  <TranscriptViewer
                    segments={transcriptSegments}
                    currentTime={audioCurrentTime}
                  />
                ) : (
                  <div className="flex items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin me-2" />
                    {t("meeting.processingTranscript") || "מעבד את התמלול..."}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
