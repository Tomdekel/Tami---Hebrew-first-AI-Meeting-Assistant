"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SUPPORTED_TRANSCRIPT_EXTENSIONS } from "@/lib/parsers";
import type { IngestionConfidence, SourceType } from "@/lib/types/database";

type UploadStatus = "idle" | "uploading" | "processing" | "complete" | "error";

interface TranscriptUploadFormProps {
  meetingTitle: string;
  meetingContext: string;
  onTitleRequired: () => void;
}

interface ParsedPreview {
  segmentCount: number;
  speakerCount: number;
  speakerNames: string[];
  confidence: IngestionConfidence;
  sourceType: SourceType;
  fullTextPreview: string;
}

export function TranscriptUploadForm({
  meetingTitle,
  meetingContext,
  onTitleRequired,
}: TranscriptUploadFormProps) {
  const t = useTranslations();
  const locale = useLocale();
  const isRTL = locale === "he";
  const router = useRouter();

  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedPreview | null>(null);

  const acceptedFormats = SUPPORTED_TRANSCRIPT_EXTENSIONS.join(",");

  const handleFileSelect = useCallback(async (file: File) => {
    // Validate file extension
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_TRANSCRIPT_EXTENSIONS.includes(ext)) {
      toast.error(t("meetings.import.failed"), {
        description: isRTL
          ? `פורמט לא נתמך. פורמטים נתמכים: ${SUPPORTED_TRANSCRIPT_EXTENSIONS.join(", ")}`
          : `Unsupported format. Supported: ${SUPPORTED_TRANSCRIPT_EXTENSIONS.join(", ")}`,
      });
      return;
    }

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(t("meetings.import.failed"), {
        description: isRTL ? "הקובץ גדול מדי (מקסימום 50MB)" : "File too large (max 50MB)",
      });
      return;
    }

    setSelectedFile(file);
    setError(null);
    setPreview(null);
  }, [t, isRTL]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;

    if (!meetingTitle.trim()) {
      onTitleRequired();
      return;
    }

    setUploadStatus("uploading");
    setUploadProgress(20);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", meetingTitle);
      if (meetingContext) {
        formData.append("context", meetingContext);
      }

      setUploadProgress(50);

      const response = await fetch("/api/sessions/import", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(80);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Import failed");
      }

      const data = await response.json();

      setSessionId(data.sessionId);
      setPreview({
        segmentCount: data.segmentCount,
        speakerCount: data.speakerCount,
        speakerNames: [],
        confidence: data.confidence,
        sourceType: data.sourceType,
        fullTextPreview: "",
      });

      setUploadStatus("complete");
      setUploadProgress(100);

      toast.success(t("meetings.import.success"));

      // Navigate to the meeting page
      setTimeout(() => {
        router.push(`/meetings/${data.sessionId}`);
      }, 1000);
    } catch (err) {
      console.error("Import failed:", err);
      setUploadStatus("error");
      setError(err instanceof Error ? err.message : "Unknown error");
      toast.error(t("meetings.import.failed"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }, [selectedFile, meetingTitle, meetingContext, onTitleRequired, router, t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  const resetUpload = useCallback(() => {
    setSelectedFile(null);
    setUploadStatus("idle");
    setUploadProgress(0);
    setError(null);
    setPreview(null);
    setSessionId(null);
  }, []);

  const getConfidenceColor = (confidence: IngestionConfidence) => {
    switch (confidence) {
      case "high":
        return "text-green-600";
      case "medium":
        return "text-yellow-600";
      case "low":
        return "text-red-600";
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      <div
        className={cn(
          "flex-1 border-2 border-dashed rounded-xl p-4 transition-all flex flex-col",
          isDragging ? "border-amber-500 bg-amber-50" : "border-border hover:border-amber-300",
          uploadStatus === "error" && "border-red-300 bg-red-50/50"
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        {selectedFile ? (
          <div className="flex-1 flex flex-col">
            {/* File info */}
            <div
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg mb-4",
                uploadStatus === "error" ? "bg-red-50" : "bg-muted/50"
              )}
            >
              {uploadStatus === "idle" && <FileText className="w-5 h-5 text-amber-600" />}
              {uploadStatus === "uploading" && <Loader2 className="w-5 h-5 animate-spin text-amber-600" />}
              {uploadStatus === "processing" && <Loader2 className="w-5 h-5 animate-spin text-teal-600" />}
              {uploadStatus === "complete" && <CheckCircle2 className="w-5 h-5 text-green-600" />}
              {uploadStatus === "error" && <AlertCircle className="w-5 h-5 text-red-600" />}

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>

              {uploadStatus !== "complete" && (
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={resetUpload}>
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {/* Progress bar */}
            {(uploadStatus === "uploading" || uploadStatus === "processing") && (
              <div className="mb-4">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-1">
                  {uploadStatus === "uploading"
                    ? t("meetings.import.processing")
                    : t("upload.processing")}
                </p>
              </div>
            )}

            {/* Preview after upload */}
            {preview && uploadStatus === "complete" && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    {t("meetings.import.success")}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-green-700">
                  <div>
                    <span className="font-medium">{t("meetings.import.segments")}:</span>{" "}
                    {preview.segmentCount}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{preview.speakerCount}</span>
                  </div>
                  <div className={getConfidenceColor(preview.confidence)}>
                    <span className="font-medium">{t(`meetings.confidence.${preview.confidence}`)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Error message */}
            {error && uploadStatus === "error" && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="mt-auto flex gap-2">
              {uploadStatus === "idle" && (
                <Button
                  onClick={handleUpload}
                  className="flex-1 bg-amber-600 hover:bg-amber-700"
                >
                  <Upload className={cn("w-4 h-4", isRTL ? "ml-2" : "mr-2")} />
                  {t("meetings.import.uploadTranscript")}
                </Button>
              )}

              {uploadStatus === "complete" && sessionId && (
                <Button
                  onClick={() => router.push(`/meetings/${sessionId}`)}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {isRTL ? "צפה בפגישה" : "View Meeting"}
                </Button>
              )}

              {uploadStatus === "error" && (
                <Button onClick={resetUpload} variant="outline" className="flex-1">
                  {isRTL ? "נסה שוב" : "Try Again"}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
              <FileText className="w-6 h-6 text-amber-600" aria-hidden="true" />
            </div>
            <h3 className="text-base font-medium mb-1">
              {isRTL ? "גרור קובץ תמלול לכאן" : "Drag transcript file here"}
            </h3>
            <p className="text-muted-foreground mb-3 text-sm">{isRTL ? "או" : "or"}</p>
            <label>
              <input
                type="file"
                accept={acceptedFormats}
                className="hidden"
                onChange={handleFileInput}
              />
              <Button variant="outline" className="cursor-pointer bg-transparent" asChild>
                <span>{t("meetings.import.selectFile")}</span>
              </Button>
            </label>
            <p className="text-xs text-muted-foreground mt-3">
              {t("meetings.import.supportedFormats")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
