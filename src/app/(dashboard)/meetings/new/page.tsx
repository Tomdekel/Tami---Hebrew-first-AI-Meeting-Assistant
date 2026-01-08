"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Upload, Loader2, FileAudio, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Recorder } from "@/components/recording";
import { toast } from "sonner";
import { uploadAudioBlob, uploadAudioChunk, combineAudioChunks, deleteAudioChunks, validateAudioForSpeech, formatValidationDetails } from "@/lib/audio";
import { createSession, startTranscription } from "@/hooks/use-session";
import { createClient } from "@/lib/supabase/client";

export default function NewMeetingPage() {
  const t = useTranslations();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [meetingContext, setMeetingContext] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track chunks during recording
  const chunkCountRef = useRef(0);
  const sessionIdRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);

  const handleRecordingComplete = useCallback(async (blob: Blob, context?: string) => {
    setIsProcessing(true);

    try {
      // Get current user
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error(t("auth.signIn"));
        setIsProcessing(false);
        return;
      }

      // Validate audio for speech content
      toast.info(t("upload.validating"));
      const validation = await validateAudioForSpeech(blob);

      if (!validation.isValid) {
        toast.error(t("upload.validationFailed"), {
          description: validation.error,
          duration: 8000,
        });
        console.log("Validation details:", formatValidationDetails(validation.details));
        setIsProcessing(false);
        return;
      }

      toast.info(t("upload.processing"));

      // If we have chunks, combine them; otherwise upload the blob directly
      let audioResult;
      if (chunkCountRef.current > 0 && sessionIdRef.current) {
        // Combine chunks
        audioResult = await combineAudioChunks(user.id, sessionIdRef.current, chunkCountRef.current);
        // Clean up chunks
        await deleteAudioChunks(user.id, sessionIdRef.current, chunkCountRef.current);

        // Update session with audio URL (and context if provided)
        await fetch(`/api/sessions/${sessionIdRef.current}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            audio_url: audioResult.url,
            ...(context ? { context } : {}),
          }),
        });
      } else {
        // Create a new session first
        const session = await createSession({
          title: `Recording ${new Date().toLocaleDateString()}`,
          context: context || undefined,
        });
        sessionIdRef.current = session.id;

        // Upload the complete blob
        audioResult = await uploadAudioBlob(blob, user.id, session.id);

        // Update session with audio URL
        await fetch(`/api/sessions/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio_url: audioResult.url }),
        });
      }

      toast.success(t("upload.success"));

      // Start transcription
      await startTranscription(sessionIdRef.current!);

      // Navigate to session detail page
      router.push(`/meetings/${sessionIdRef.current}`);
    } catch (error) {
      console.error("Failed to process recording:", error);
      toast.error(t("upload.failed"), {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsProcessing(false);
      chunkCountRef.current = 0;
      sessionIdRef.current = null;
    }
  }, [router, t]);

  const handleChunk = useCallback(async (chunk: Blob, index: number) => {
    try {
      // Get current user
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return;

      // Create session on first chunk if needed
      if (index === 0 && !sessionIdRef.current) {
        const session = await createSession({
          title: `Recording ${new Date().toLocaleDateString()}`,
        });
        sessionIdRef.current = session.id;
        userIdRef.current = user.id;
      }

      // Upload chunk for backup
      if (sessionIdRef.current) {
        await uploadAudioChunk(chunk, user.id, sessionIdRef.current, index);
        chunkCountRef.current = index + 1;
      }
    } catch (error) {
      console.error(`Failed to upload chunk ${index}:`, error);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
        toast.error(t("upload.invalidType"), {
          description: t("upload.selectAudioFile"),
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  // Removed auto-upload - user must click "Start Transcription" button

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // Get current user
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast.error(t("auth.signIn"));
        setIsUploading(false);
        return;
      }

      // Validate audio for speech content
      toast.info(t("upload.validating"));
      const validation = await validateAudioForSpeech(selectedFile);

      if (!validation.isValid) {
        toast.error(t("upload.validationFailed"), {
          description: validation.error,
          duration: 8000,
        });
        console.log("Validation details:", formatValidationDetails(validation.details));
        setIsUploading(false);
        setSelectedFile(null);
        return;
      }

      toast.info(t("upload.uploading"));

      // Create session with context
      const session = await createSession({
        title: selectedFile.name.replace(/\.[^/.]+$/, ""), // Remove extension
        context: meetingContext || undefined,
      });

      // Upload file
      const audioResult = await uploadAudioBlob(
        selectedFile,
        user.id,
        session.id,
        selectedFile.name
      );

      // Update session with audio URL
      await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio_url: audioResult.url }),
      });

      toast.success(t("upload.success"));

      // Start transcription
      await startTranscription(session.id);

      // Navigate to session detail page
      router.push(`/meetings/${session.id}`);
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error(t("upload.failed"), {
        description: error instanceof Error ? error.message : "Unknown error",
      });
      setSelectedFile(null);
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelectedFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/meetings"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 icon-flip-rtl" />
          {t("common.back")}
        </Link>
        <h1 className="text-3xl font-bold">{t("nav.newMeeting")}</h1>
      </div>

      {/* Tabs: Record or Upload */}
      <Tabs defaultValue="record" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="record">{t("recording.start")}</TabsTrigger>
          <TabsTrigger value="upload">{t("upload.title")}</TabsTrigger>
        </TabsList>

        {/* Record Tab */}
        <TabsContent value="record" className="space-y-6">
          {/* Context Field */}
          <Card>
            <CardHeader>
              <CardTitle>{t("upload.contextTitle")}</CardTitle>
              <CardDescription>
                {t("upload.contextDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder={t("upload.contextPlaceholder")}
                value={meetingContext}
                onChange={(e) => setMeetingContext(e.target.value)}
                disabled={isProcessing}
                className="min-h-[100px] max-h-[300px] resize-y"
                dir="auto"
              />
            </CardContent>
          </Card>

          <Recorder
            onRecordingComplete={(blob) => handleRecordingComplete(blob, meetingContext)}
            onChunk={handleChunk}
          />
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <div className="space-y-6">
            {/* Context Field */}
            <Card>
              <CardHeader>
                <CardTitle>{t("upload.contextTitle")}</CardTitle>
                <CardDescription>
                  {t("upload.contextDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder={t("upload.contextPlaceholder")}
                  value={meetingContext}
                  onChange={(e) => setMeetingContext(e.target.value)}
                  disabled={isUploading}
                  className="min-h-[100px] max-h-[300px] resize-y"
                  dir="auto"
                />
              </CardContent>
            </Card>

            {/* Upload Area / File Ready */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedFile && !isUploading
                    ? t("upload.fileReady")
                    : t("upload.selectFile")}
                </CardTitle>
                <CardDescription>
                  {selectedFile && !isUploading
                    ? t("upload.readyToProcess")
                    : t("upload.supportedFormats")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <div className="text-center">
                      <p className="font-medium">{t("upload.uploading")}</p>
                      {selectedFile && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                        </p>
                      )}
                    </div>
                  </div>
                ) : selectedFile ? (
                  <div className="space-y-4">
                    {/* File info */}
                    <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
                      <FileAudio className="h-10 w-10 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={clearSelectedFile}
                        className="flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-3 justify-end">
                      <Button variant="outline" onClick={clearSelectedFile}>
                        {t("common.cancel")}
                      </Button>
                      <Button onClick={handleUpload}>
                        {t("upload.startTranscription")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <FileAudio className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="font-medium">{t("upload.clickToSelect")}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {t("upload.orDragDrop")}
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*,video/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
