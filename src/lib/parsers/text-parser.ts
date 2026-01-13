import type { ParsedTranscript, TranscriptSegment, ParserOptions } from "./types";
import type { ExternalFormat } from "@/lib/types/database";

/**
 * Parse plain text transcript files (.txt, .md)
 *
 * Supports various speaker patterns:
 * - Speaker Name: text
 * - [Speaker Name] text
 * - **Speaker Name**: text (markdown)
 * - *Speaker Name*: text (markdown)
 * - AI transcript format (multi-line with S separator)
 *
 * Falls back to paragraph-based segmentation if no speakers detected.
 */

/**
 * Detect AI transcription format with multi-line speaker attribution
 * Format: text, S separator, Speaker N, timestamp (MM:SS)
 */
function detectAITranscriptFormat(lines: string[]): boolean {
  // Look for "S" separator followed by "Speaker N" and timestamp pattern
  for (let i = 0; i < Math.min(50, lines.length - 2); i++) {
    const line = lines[i].trim();
    if (line === "S" && i + 2 < lines.length) {
      const speakerLine = lines[i + 1].trim();
      const timestampLine = lines[i + 2].trim();
      if (/^Speaker \d+$/i.test(speakerLine) && /^\d{1,2}:\d{2}$/.test(timestampLine)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Parse AI transcription format with multi-line structure
 * Structure: text content, "S" separator, "Speaker N", "MM:SS" timestamp
 */
function parseAITranscriptFormat(
  lines: string[],
  speakerSet: Set<string>
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let currentTextLines: string[] = [];
  let pendingSpeaker: string | null = null;
  let pendingStartTime: number | null = null;

  const flushSegment = () => {
    if (currentTextLines.length > 0 && pendingSpeaker) {
      const text = currentTextLines.join(" ").trim();
      if (text) {
        segments.push({
          speaker: pendingSpeaker,
          text,
          startTime: pendingStartTime,
          endTime: null,
        });
        speakerSet.add(pendingSpeaker);
      }
    }
    currentTextLines = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      i++;
      continue;
    }

    // Check for "S" separator pattern
    if (line === "S" && i + 2 < lines.length) {
      const speakerLine = lines[i + 1].trim();
      const timestampLine = lines[i + 2].trim();

      const speakerMatch = speakerLine.match(/^Speaker (\d+)$/i);
      const timestampMatch = timestampLine.match(/^(\d{1,2}):(\d{2})$/);

      if (speakerMatch && timestampMatch) {
        // Flush previous segment
        flushSegment();

        // Set up new segment
        pendingSpeaker = `Speaker ${speakerMatch[1]}`;
        pendingStartTime = parseInt(timestampMatch[1]) * 60 + parseInt(timestampMatch[2]);

        i += 3; // Skip S, Speaker N, and timestamp
        continue;
      }
    }

    // Regular text line - add to current segment
    if (line !== "S") {
      currentTextLines.push(line);
    }

    i++;
  }

  // Flush final segment
  flushSegment();

  return segments;
}

// Regex patterns for speaker detection
const SPEAKER_PATTERNS = [
  // Standard patterns
  /^([^:]{1,50}):\s+(.+)/,                    // Name: text
  /^\[([^\]]{1,50})\]\s*(.+)/,                // [Name] text
  /^\(([^)]{1,50})\)\s*(.+)/,                 // (Name) text

  // Markdown patterns
  /^\*\*([^*]{1,50})\*\*:\s*(.+)/,            // **Name**: text
  /^\*([^*]{1,50})\*:\s*(.+)/,                // *Name*: text

  // Meeting transcript patterns
  /^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*\([\d:]+\):\s*(.+)/, // Name (timestamp): text
];

/**
 * Try to extract speaker from a line
 */
function extractSpeakerFromLine(line: string): { speaker: string; text: string } | null {
  for (const pattern of SPEAKER_PATTERNS) {
    const match = line.match(pattern);
    if (match) {
      const speaker = match[1].trim();
      const text = match[2].trim();

      // Skip false positives
      if (speaker.length < 2) continue;
      if (speaker.includes("://")) continue; // URLs
      if (/^\d+$/.test(speaker)) continue; // Pure numbers
      if (speaker.toLowerCase().startsWith("http")) continue;

      return { speaker, text };
    }
  }
  return null;
}

/**
 * Detect if the content appears to be a meeting transcript
 */
function isMeetingTranscript(lines: string[]): boolean {
  let speakerLineCount = 0;
  const sampleSize = Math.min(20, lines.length);

  for (let i = 0; i < sampleSize; i++) {
    if (extractSpeakerFromLine(lines[i])) {
      speakerLineCount++;
    }
  }

  // If more than 30% of sampled lines have speakers, it's likely a transcript
  return speakerLineCount / sampleSize > 0.3;
}

export function parseText(
  content: string,
  format: ExternalFormat,
  options: ParserOptions = {}
): ParsedTranscript {
  const { defaultSpeakerPrefix = "Speaker" } = options;
  const lines = content.split(/\r?\n/);
  const nonEmptyLines = lines.filter(line => line.trim());
  const segments: TranscriptSegment[] = [];
  const speakerSet = new Set<string>();

  // Check for AI transcript format first (multi-line with S separator)
  const isAIFormat = detectAITranscriptFormat(nonEmptyLines);

  if (isAIFormat) {
    // Parse AI transcript format
    const parsedSegments = parseAITranscriptFormat(nonEmptyLines, speakerSet);
    segments.push(...parsedSegments);
  } else {
    // Fall back to standard parsing
    const isTranscript = isMeetingTranscript(nonEmptyLines);
    let speakerCounter = 0;

    if (isTranscript) {
    // Parse as speaker-attributed transcript
    let currentSpeaker: string | null = null;
    let currentTextLines: string[] = [];

    const flushSegment = () => {
      if (currentTextLines.length > 0) {
        const text = currentTextLines.join(" ").trim();
        if (text) {
          segments.push({
            startTime: null,
            endTime: null,
            speaker: currentSpeaker,
            text,
          });
        }
        currentTextLines = [];
      }
    };

    for (const line of lines) {
      const extracted = extractSpeakerFromLine(line);

      if (extracted) {
        // New speaker line
        flushSegment();
        currentSpeaker = extracted.speaker;
        speakerSet.add(extracted.speaker);
        currentTextLines.push(extracted.text);
      } else {
        // Continuation of current speaker
        currentTextLines.push(line.trim());
      }
    }

    flushSegment();
  } else {
    // Parse as paragraphs - split on double newlines or use each line as segment
    const paragraphs = content.split(/\n{2,}/).filter(p => p.trim());

    for (const paragraph of paragraphs) {
      const text = paragraph.replace(/\n/g, " ").trim();
      if (text) {
        speakerCounter++;
        segments.push({
          startTime: null,
          endTime: null,
          speaker: `${defaultSpeakerPrefix} ${speakerCounter}`,
          text,
        });
      }
    }
  }
  } // End of else block for non-AI format

  // Build full text
  const fullText = segments.map(s => s.text).join("\n");
  const hasSpeakers = speakerSet.size > 0;
  const hasTimestamps = isAIFormat && segments.some(s => s.startTime !== null);

  // Calculate confidence
  let confidence: "high" | "medium" | "low";
  if (isAIFormat && hasSpeakers && hasTimestamps) {
    // AI format with speakers and timestamps is high confidence
    confidence = "high";
  } else if (hasSpeakers && fullText.length > 0) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    segments,
    fullText,
    hasTimestamps,
    hasSpeakers,
    speakerNames: Array.from(speakerSet),
    confidence,
    format,
  };
}
