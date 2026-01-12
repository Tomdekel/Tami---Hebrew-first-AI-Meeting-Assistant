import type { ParsedTranscript, TranscriptSegment, ParserOptions } from "./types";

/**
 * Parse SubRip (.srt) subtitle files
 *
 * SRT format:
 * 1
 * 00:00:00,000 --> 00:00:05,000
 * Hello, this is the transcript.
 *
 * 2
 * 00:00:05,000 --> 00:00:10,000
 * John: This is another segment.
 */

// Regex patterns for SRT parsing
const SEQUENCE_NUMBER = /^\d+$/;
const TIMESTAMP_LINE = /^(\d{2}:\d{2}:\d{2}[,.]?\d{0,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]?\d{0,3})/;
const SPEAKER_PREFIX = /^([^:]+):\s*/;
const SPEAKER_BRACKET = /^\[([^\]]+)\]\s*/;

/**
 * Convert SRT timestamp to seconds
 * Format: HH:MM:SS,mmm (note: comma is standard for SRT, not period)
 */
function parseTimestamp(timestamp: string): number {
  // Normalize: SRT uses comma for milliseconds, convert to period
  const normalized = timestamp.replace(",", ".");
  const parts = normalized.split(":");

  if (parts.length < 2) {
    return 0;
  }

  if (parts.length === 2) {
    // MM:SS.mmm format
    const minutes = parseInt(parts[0], 10);
    const secondsAndMs = parseFloat(parts[1]);
    return minutes * 60 + secondsAndMs;
  }

  // HH:MM:SS.mmm format
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const secondsAndMs = parseFloat(parts[2]);

  return hours * 3600 + minutes * 60 + secondsAndMs;
}

/**
 * Extract speaker name from text content
 * Supports:
 * - Speaker Name: text
 * - [Speaker Name] text
 */
function extractSpeaker(text: string): { speaker: string | null; cleanText: string } {
  // Check for [Speaker] pattern
  const bracketMatch = text.match(SPEAKER_BRACKET);
  if (bracketMatch) {
    const speaker = bracketMatch[1].trim();
    const cleanText = text.replace(SPEAKER_BRACKET, "").trim();
    return { speaker, cleanText };
  }

  // Check for "Speaker: text" pattern
  const prefixMatch = text.match(SPEAKER_PREFIX);
  if (prefixMatch) {
    const potentialSpeaker = prefixMatch[1].trim();
    // Avoid false positives: skip if it looks like a URL or timestamp
    if (!potentialSpeaker.includes("//") && !potentialSpeaker.match(/^\d/)) {
      const cleanText = text.replace(SPEAKER_PREFIX, "").trim();
      return { speaker: potentialSpeaker, cleanText };
    }
  }

  return { speaker: null, cleanText: text.trim() };
}

export function parseSRT(content: string, options: ParserOptions = {}): ParsedTranscript {
  const { defaultSpeakerPrefix = "Speaker" } = options;
  const lines = content.split(/\r?\n/);
  const segments: TranscriptSegment[] = [];
  const speakerSet = new Set<string>();

  let hasTimestamps = false;
  let hasSpeakers = false;
  let currentStartTime: number | null = null;
  let currentEndTime: number | null = null;
  let currentTextLines: string[] = [];
  let speakerCounter = 0;

  const flushSegment = () => {
    if (currentTextLines.length > 0) {
      const rawText = currentTextLines.join(" ").trim();
      if (rawText) {
        const { speaker, cleanText } = extractSpeaker(rawText);

        let finalSpeaker = speaker;
        if (speaker) {
          hasSpeakers = true;
          speakerSet.add(speaker);
        } else {
          // Assign default speaker
          speakerCounter++;
          finalSpeaker = `${defaultSpeakerPrefix} ${speakerCounter}`;
        }

        segments.push({
          startTime: currentStartTime,
          endTime: currentEndTime,
          speaker: finalSpeaker,
          text: cleanText,
        });
      }
    }
    currentTextLines = [];
    currentStartTime = null;
    currentEndTime = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines - they separate subtitle blocks
    if (!line) {
      flushSegment();
      continue;
    }

    // Skip sequence numbers
    if (SEQUENCE_NUMBER.test(line)) {
      continue;
    }

    // Check for timestamp line
    const timestampMatch = line.match(TIMESTAMP_LINE);
    if (timestampMatch) {
      flushSegment();
      hasTimestamps = true;
      currentStartTime = parseTimestamp(timestampMatch[1]);
      currentEndTime = parseTimestamp(timestampMatch[2]);
      continue;
    }

    // Accumulate text content (strip HTML tags that some SRT files contain)
    const cleanLine = line.replace(/<[^>]*>/g, "");
    if (cleanLine) {
      currentTextLines.push(cleanLine);
    }
  }

  // Flush any remaining segment
  flushSegment();

  // Build full text
  const fullText = segments.map(s => s.text).join("\n");

  // Calculate confidence
  let confidence: "high" | "medium" | "low";
  if (hasTimestamps && hasSpeakers && fullText.length > 0) {
    confidence = "high";
  } else if ((hasTimestamps || hasSpeakers) && fullText.length > 0) {
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
    format: "srt",
  };
}
