import type { ParsedTranscript, ParserOptions } from "./types";
import type { ExternalFormat } from "@/lib/types/database";
import { parseVTT } from "./vtt-parser";
import { parseSRT } from "./srt-parser";
import { parseText } from "./text-parser";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export type { ParsedTranscript, TranscriptSegment, ParserOptions } from "./types";

// File extension to format mapping
const EXTENSION_FORMAT_MAP: Record<string, ExternalFormat> = {
  ".vtt": "vtt",
  ".srt": "srt",
  ".txt": "text",
  ".md": "md",
  ".docx": "doc",
  ".doc": "doc",
  ".pdf": "pdf",
};

// MIME type to format mapping
const MIME_FORMAT_MAP: Record<string, ExternalFormat> = {
  "text/vtt": "vtt",
  "application/x-subrip": "srt",
  "text/plain": "text",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "doc",
  "application/msword": "doc",
  "application/pdf": "pdf",
};

// Supported file extensions for transcript upload
export const SUPPORTED_TRANSCRIPT_EXTENSIONS = [".vtt", ".srt", ".txt", ".md", ".docx", ".pdf"];

// Supported MIME types for transcript upload
export const SUPPORTED_TRANSCRIPT_MIMES = [
  "text/vtt",
  "application/x-subrip",
  "text/plain",
  "text/markdown",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/pdf",
];

/**
 * Detect the format from filename or MIME type
 */
export function detectFormat(filename: string, mimeType?: string): ExternalFormat | null {
  // Try MIME type first
  if (mimeType && MIME_FORMAT_MAP[mimeType]) {
    return MIME_FORMAT_MAP[mimeType];
  }

  // Fall back to extension
  const lowerFilename = filename.toLowerCase();
  for (const [ext, format] of Object.entries(EXTENSION_FORMAT_MAP)) {
    if (lowerFilename.endsWith(ext)) {
      return format;
    }
  }

  return null;
}

/**
 * Check if a file is a supported transcript format
 */
export function isSupportedTranscriptFormat(filename: string, mimeType?: string): boolean {
  return detectFormat(filename, mimeType) !== null;
}

/**
 * Extract text from a Word document (.docx)
 */
async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Extract text from a PDF file
 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  const textResult = await parser.getText();
  await parser.destroy();
  return textResult.text;
}

/**
 * Parse transcript content from various formats
 *
 * @param content - The file content (as string for text formats, Buffer for binary)
 * @param filename - Original filename for format detection
 * @param options - Parser options
 * @param mimeType - Optional MIME type for format detection
 */
export async function parseTranscript(
  content: string | Buffer,
  filename: string,
  options: ParserOptions = {},
  mimeType?: string
): Promise<ParsedTranscript> {
  const format = detectFormat(filename, mimeType);

  if (!format) {
    throw new Error(`Unsupported transcript format for file: ${filename}`);
  }

  // For binary formats, convert Buffer to string
  let textContent: string;

  switch (format) {
    case "vtt":
      textContent = typeof content === "string" ? content : content.toString("utf-8");
      return parseVTT(textContent, options);

    case "srt":
      textContent = typeof content === "string" ? content : content.toString("utf-8");
      return parseSRT(textContent, options);

    case "text":
      textContent = typeof content === "string" ? content : content.toString("utf-8");
      return parseText(textContent, "text", options);

    case "md":
      textContent = typeof content === "string" ? content : content.toString("utf-8");
      return parseText(textContent, "md", options);

    case "doc":
      // Word documents need special handling
      if (typeof content === "string") {
        // If string was passed, treat as plain text
        return parseText(content, "doc", options);
      }
      textContent = await extractTextFromDocx(content);
      return parseText(textContent, "doc", options);

    case "pdf":
      // PDF needs special handling
      if (typeof content === "string") {
        // If string was passed, treat as plain text
        return parseText(content, "pdf", options);
      }
      textContent = await extractTextFromPDF(content);
      return parseText(textContent, "pdf", options);

    default:
      throw new Error(`Parser not implemented for format: ${format}`);
  }
}

/**
 * Calculate confidence based on transcript features
 */
export function calculateConfidence(
  hasTimestamps: boolean,
  hasSpeakers: boolean,
  hasContent: boolean
): "high" | "medium" | "low" {
  if (hasTimestamps && hasSpeakers && hasContent) {
    return "high";
  } else if ((hasTimestamps || hasSpeakers) && hasContent) {
    return "medium";
  } else {
    return "low";
  }
}

/**
 * Determine source type based on content characteristics
 */
export function determineSourceType(
  parsed: ParsedTranscript
): "imported" | "summary_only" {
  // If there are multiple segments with distinct speakers, it's a full transcript
  // If it's just one big chunk of text, treat as summary_only
  if (parsed.segments.length === 1 && !parsed.hasSpeakers && !parsed.hasTimestamps) {
    return "summary_only";
  }
  return "imported";
}
