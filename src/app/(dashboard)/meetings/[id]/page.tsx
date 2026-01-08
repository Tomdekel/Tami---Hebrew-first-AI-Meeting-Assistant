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
  MessageSquare,
  FileText,
  Send,
  CheckSquare,
  Square,
  Tags,
  Users,
  Plus,
  X,
  MoreVertical,
  Paperclip,
  Upload,
  Download,
  Brain,
  RotateCcw,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import type { ChatMessage } from "@/lib/types/database";

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

interface Entity {
  id: string;
  type: string;
  value: string;
  normalizedValue: string;
  mentionCount: number;
  context?: string;
}

interface Attachment {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [chatLoaded, setChatLoaded] = useState(false);

  // Tags state
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);

  // Entities state
  const [entities, setEntities] = useState<Entity[]>([]);
  const [entitiesLoaded, setEntitiesLoaded] = useState(false);
  const [isExtractingEntities, setIsExtractingEntities] = useState(false);

  // Speakers state
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [speakersLoaded, setSpeakersLoaded] = useState(false);
  const [editingSpeaker, setEditingSpeaker] = useState<Speaker | null>(null);
  const [newSpeakerName, setNewSpeakerName] = useState("");

  // Attachments state
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentsLoaded, setAttachmentsLoaded] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);

  // Reprocess state
  const [isReprocessing, setIsReprocessing] = useState(false);

  // Export state
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

  // Load entities
  const loadEntities = useCallback(async () => {
    if (entitiesLoaded) return;
    try {
      const res = await fetch(`/api/sessions/${id}/entities`);
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entities || []);
      }
      setEntitiesLoaded(true);
    } catch (err) {
      console.error("Failed to load entities:", err);
    }
  }, [id, entitiesLoaded]);

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

  // Load attachments
  const loadAttachments = useCallback(async () => {
    if (attachmentsLoaded) return;
    try {
      const res = await fetch(`/api/sessions/${id}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data.attachments || []);
      }
      setAttachmentsLoaded(true);
    } catch (err) {
      console.error("Failed to load attachments:", err);
    }
  }, [id, attachmentsLoaded]);

  // Load on mount for tags and attachments
  useEffect(() => {
    loadTags();
    loadAttachments();
  }, [loadTags, loadAttachments]);

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

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    try {
      const response = await fetch(`/api/sessions/${id}/summarize`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate summary");
      }

      toast.success("Summary generated");
      refetch();
    } catch (err) {
      toast.error("Failed to generate summary", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsSummarizing(false);
    }
  };

  const loadChatHistory = useCallback(async () => {
    if (chatLoaded) return;
    try {
      const response = await fetch(`/api/sessions/${id}/chat`);
      if (response.ok) {
        const data = await response.json();
        setChatMessages(data.messages || []);
        setChatLoaded(true);
      }
    } catch (err) {
      console.error("Failed to load chat history:", err);
    }
  }, [id, chatLoaded]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSendingChat) return;

    const question = chatInput.trim();
    setChatInput("");
    setIsSendingChat(true);

    const userMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      session_id: id,
      role: "user",
      content: question,
      created_at: new Date().toISOString(),
    };
    setChatMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch(`/api/sessions/${id}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to get answer");
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: data.messageId || `temp-${Date.now()}-response`,
        session_id: id,
        role: "assistant",
        content: data.answer,
        created_at: new Date().toISOString(),
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      toast.error("Failed to get answer", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
      setChatMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
      setChatInput(question);
    } finally {
      setIsSendingChat(false);
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

  const handleToggleActionItem = async (actionItemId: string, completed: boolean) => {
    try {
      const response = await fetch(`/api/sessions/${id}/action-items/${actionItemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed }),
      });

      if (!response.ok) throw new Error("Failed to update action item");

      toast.success(completed ? "Action item completed" : "Action item uncompleted");
      refetch();
    } catch (err) {
      toast.error("Failed to update action item");
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

  const handleExtractEntities = async () => {
    setIsExtractingEntities(true);
    try {
      const response = await fetch(`/api/sessions/${id}/entities`, {
        method: "POST",
      });

      if (!response.ok) throw new Error("Failed to extract entities");

      const data = await response.json();
      setEntities(data.entities || []);
      toast.success(`Extracted ${data.extractedCount} entities`);
    } catch (err) {
      toast.error("Failed to extract entities");
    } finally {
      setIsExtractingEntities(false);
    }
  };

  const handleRenameSpeaker = async () => {
    if (!editingSpeaker || !newSpeakerName.trim()) return;

    try {
      const response = await fetch(`/api/sessions/${id}/speakers`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          speakerId: editingSpeaker.speakerId,
          newName: newSpeakerName.trim(),
        }),
      });

      if (!response.ok) throw new Error("Failed to rename speaker");

      toast.success("Speaker renamed");
      setSpeakers((prev) =>
        prev.map((s) =>
          s.speakerId === editingSpeaker.speakerId
            ? { ...s, speakerName: newSpeakerName.trim() }
            : s
        )
      );
      setEditingSpeaker(null);
      setNewSpeakerName("");
      refetch();
    } catch (err) {
      toast.error("Failed to rename speaker");
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingAttachment(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`/api/sessions/${id}/attachments`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to upload file");
      }

      const data = await response.json();
      setAttachments((prev) => [data.attachment, ...prev]);
      toast.success("File uploaded");
    } catch (err) {
      toast.error("Failed to upload file", {
        description: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = "";
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const response = await fetch(`/api/sessions/${id}/attachments/${attachmentId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete attachment");

      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success("Attachment deleted");
    } catch (err) {
      toast.error("Failed to delete attachment");
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
      setEntitiesLoaded(false);
      loadEntities();
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

      // Download the file
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
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
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
  const hasSummary = session.summary && session.summary.overview;

  // Transform segments for TranscriptViewer
  const transcriptSegments = session.transcript?.segments?.map((seg) => ({
    speakerId: seg.speaker_id,
    speakerName: seg.speaker_name || seg.speaker_id,
    text: seg.text,
    startTime: seg.start_time,
    endTime: seg.end_time,
    segmentOrder: seg.segment_order,
  })) || [];

  const availableTagsToAdd = allTags.filter(
    (t) => !tags.some((existing) => existing.id === t.id)
  );

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
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
            {session.status === "processing" && <Loader2 className="h-3 w-3 me-1 animate-spin" />}
            {session.status === "completed" && <CheckCircle2 className="h-3 w-3 me-1" />}
            {session.status === "completed" && t("meeting.completed")}
            {session.status === "failed" && t("meeting.failed")}
            {session.status === "processing" && t("meeting.processing")}
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

      {/* Main Content Tabs */}
      {hasTranscript && (
        <Tabs defaultValue="transcript" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="transcript" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">{t("meeting.transcript")}</span>
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">{t("meeting.summary")}</span>
            </TabsTrigger>
            <TabsTrigger value="speakers" className="gap-2" onClick={loadSpeakers}>
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">{t("meeting.speakers")}</span>
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2" onClick={loadEntities}>
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">{t("meeting.insights")}</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2" onClick={loadChatHistory}>
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">{t("meeting.questions")}</span>
            </TabsTrigger>
          </TabsList>

          {/* Transcript Tab */}
          <TabsContent value="transcript">
            <Card>
              <CardHeader>
                <CardTitle>{t("meeting.transcript")}</CardTitle>
                <CardDescription>
                  {session.transcript?.segments?.length || 0} segments • Click to jump to timestamp
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TranscriptViewer
                  segments={transcriptSegments}
                  currentTime={audioCurrentTime}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Summary Tab */}
          <TabsContent value="summary">
            {hasSummary ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("meeting.overview")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-foreground">{session.summary!.overview}</p>
                  </CardContent>
                </Card>

                {session.summary!.key_points && session.summary!.key_points.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("meeting.keyPoints")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {session.summary!.key_points.map((point, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {session.summary!.decisions && session.summary!.decisions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("meeting.decisions")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {session.summary!.decisions.map((decision, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                            <div>
                              <p>{decision.description}</p>
                              {decision.context && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {decision.context}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {session.summary!.action_items && session.summary!.action_items.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{t("meeting.actions")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-3">
                        {session.summary!.action_items.map((item) => (
                          <li key={item.id} className="flex items-start gap-3">
                            <button
                              onClick={() => handleToggleActionItem(item.id, !item.completed)}
                              className="mt-0.5 text-muted-foreground hover:text-foreground"
                            >
                              {item.completed ? (
                                <CheckSquare className="h-5 w-5 text-green-500" />
                              ) : (
                                <Square className="h-5 w-5" />
                              )}
                            </button>
                            <div className="flex-1">
                              <p className={item.completed ? "line-through text-muted-foreground" : ""}>
                                {item.description}
                              </p>
                              {(item.assignee || item.deadline) && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {item.assignee && <span>{t("meeting.assignedTo")} {item.assignee}</span>}
                                  {item.assignee && item.deadline && <span> • </span>}
                                  {item.deadline && <span>{t("meeting.due")} {item.deadline}</span>}
                                </p>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-medium mb-2">{t("meeting.noSummaryYet")}</h3>
                  <p className="text-sm text-muted-foreground text-center mb-4">
                    {t("meeting.noSummaryDesc")}
                  </p>
                  <Button onClick={handleGenerateSummary} disabled={isSummarizing}>
                    {isSummarizing && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                    <Sparkles className="h-4 w-4 me-2" />
                    {t("meeting.generateSummary")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Speakers Tab */}
          <TabsContent value="speakers">
            <Card>
              <CardHeader>
                <CardTitle>{t("meeting.speakers")}</CardTitle>
                <CardDescription>
                  {t("meeting.editSpeakerNames")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {speakers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    {t("meeting.noSpeakersIdentified")}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {speakers.map((speaker) => (
                      <div
                        key={speaker.speakerId}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{speaker.speakerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {speaker.segmentCount} {t("meeting.segments")}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSpeaker(speaker);
                            setNewSpeakerName(speaker.speakerName);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Edit Speaker Dialog */}
            <Dialog open={!!editingSpeaker} onOpenChange={() => setEditingSpeaker(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("meeting.renameSpeaker")}</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="speakerName">{t("meeting.speakerName")}</Label>
                  <Input
                    id="speakerName"
                    value={newSpeakerName}
                    onChange={(e) => setNewSpeakerName(e.target.value)}
                    placeholder={t("meeting.enterSpeakerName")}
                    className="mt-2"
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingSpeaker(null)}>
                    {t("common.cancel")}
                  </Button>
                  <Button onClick={handleRenameSpeaker} disabled={!newSpeakerName.trim()}>
                    {t("common.save")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* Insights Tab (Entities) */}
          <TabsContent value="insights">
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{t("meeting.extractedEntities")}</CardTitle>
                      <CardDescription>
                        {t("meeting.entitiesDesc")}
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExtractEntities}
                      disabled={isExtractingEntities}
                    >
                      {isExtractingEntities ? (
                        <Loader2 className="h-4 w-4 me-2 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4 me-2" />
                      )}
                      {entities.length > 0 ? t("meeting.reExtract") : t("meeting.extract")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {entities.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>{t("meeting.noEntitiesYet")}</p>
                      <p className="text-sm mt-1">
                        {t("meeting.noEntitiesDesc")}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {["person", "organization", "project", "topic", "technology"].map((type) => {
                        const typeEntities = entities.filter((e) => e.type === type);
                        if (typeEntities.length === 0) return null;

                        return (
                          <div key={type}>
                            <h4 className="text-sm font-medium text-muted-foreground mb-2 capitalize">
                              {type}s
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {typeEntities.map((entity) => (
                                <Badge key={entity.id} variant="secondary">
                                  {entity.value}
                                  {entity.mentionCount > 1 && (
                                    <span className="ms-1 text-xs opacity-70">
                                      ({entity.mentionCount})
                                    </span>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Attachments */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Paperclip className="h-5 w-5" />
                        {t("meeting.attachments")}
                      </CardTitle>
                      <CardDescription>
                        {t("meeting.attachmentsDesc")}
                      </CardDescription>
                    </div>
                    <div>
                      <input
                        type="file"
                        id="attachment-upload"
                        className="hidden"
                        onChange={handleUploadAttachment}
                        disabled={isUploadingAttachment}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("attachment-upload")?.click()}
                        disabled={isUploadingAttachment}
                      >
                        {isUploadingAttachment ? (
                          <Loader2 className="h-4 w-4 me-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 me-2" />
                        )}
                        {t("upload.title")}
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {attachments.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      {t("meeting.noAttachmentsYet")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {attachments.map((attachment) => (
                        <div
                          key={attachment.id}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <Paperclip className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium text-sm">{attachment.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(attachment.fileSize)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                            >
                              <a href={attachment.fileUrl} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAttachment(attachment.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent value="chat">
            <Card className="flex flex-col h-[500px]">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{t("meeting.questions")}</CardTitle>
                <CardDescription>{t("meeting.askAboutMeeting")}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                  {chatMessages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <p>{t("meeting.askAboutMeeting")}</p>
                    </div>
                  ) : (
                    chatMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-4 py-2 ${
                            message.role === "user"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted"
                          }`}
                        >
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                  {isSendingChat && (
                    <div className="flex justify-start">
                      <div className="bg-muted rounded-lg px-4 py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Input
                    placeholder={t("meeting.askQuestion")}
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    disabled={isSendingChat}
                  />
                  <Button onClick={handleSendMessage} disabled={isSendingChat || !chatInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
