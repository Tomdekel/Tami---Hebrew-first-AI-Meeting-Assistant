"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Upload } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Recorder } from "@/components/recording";
import { toast } from "sonner";

export default function NewMeetingPage() {
  const t = useTranslations();
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleRecordingComplete = useCallback(async (blob: Blob) => {
    toast.success("Recording saved!", {
      description: `Size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`,
    });
    // TODO: Upload to Supabase and start transcription
    console.log("Recording complete:", blob);
  }, []);

  const handleChunk = useCallback((chunk: Blob, index: number) => {
    console.log(`Chunk ${index}:`, chunk.size, "bytes");
    // TODO: Upload chunk to Supabase Storage for backup
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith("audio/") && !file.type.startsWith("video/")) {
        toast.error("Invalid file type", {
          description: "Please select an audio or video file",
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    try {
      // TODO: Upload to Supabase Storage and start transcription
      toast.success("File uploaded!", {
        description: selectedFile.name,
      });
      console.log("Uploading file:", selectedFile);
    } catch (error) {
      toast.error("Upload failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 icon-flip-rtl" />
          Back
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
          <Recorder
            onRecordingComplete={handleRecordingComplete}
            onChunk={handleChunk}
          />
        </TabsContent>

        {/* Upload Tab */}
        <TabsContent value="upload">
          <Card>
            <CardHeader>
              <CardTitle>{t("upload.title")}</CardTitle>
              <CardDescription>
                {t("upload.dropzone")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid w-full items-center gap-4">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="audio-file">Audio File</Label>
                  <Input
                    id="audio-file"
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                </div>

                {selectedFile && (
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || isUploading}
                  className="gap-2"
                >
                  <Upload className="h-4 w-4" />
                  {isUploading ? t("upload.uploading") : t("upload.title")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
