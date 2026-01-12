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
 *
 * Falls back to paragraph-based segmentation if no speakers detected.
 */

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
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  const segments: TranscriptSegment[] = [];
  const speakerSet = new Set<string>();

  const isTranscript = isMeetingTranscript(lines);
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

  // Build full text
  const fullText = segments.map(s => s.text).join("\n");
  const hasSpeakers = speakerSet.size > 0;

  // Calculate confidence - no timestamps for plain text
  let confidence: "high" | "medium" | "low";
  if (hasSpeakers && fullText.length > 0) {
    confidence = "medium";
  } else {
    confidence = "low";
  }

  return {
    segments,
    fullText,
    hasTimestamps: false,
    hasSpeakers,
    speakerNames: Array.from(speakerSet),
    confidence,
    format,
  };
}
