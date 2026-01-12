import type { ParsedTranscript, TranscriptSegment, ParserOptions } from "./types";

/**
 * Parse WebVTT (.vtt) transcript files
 *
 * WebVTT format:
 * WEBVTT
 *
 * 00:00:00.000 --> 00:00:05.000
 * <v Speaker Name>Hello, this is the transcript.
 *
 * Or with speaker prefix:
 * 00:00:05.000 --> 00:00:10.000
 * John: This is another segment.
 */

// Regex patterns for VTT parsing
const VTT_HEADER = /^WEBVTT/;
const TIMESTAMP_LINE = /^(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/;
const SPEAKER_V_TAG = /<v\s+([^>]+)>/;
const SPEAKER_PREFIX = /^([^:]+):\s*/;

/**
 * Convert VTT timestamp to seconds
 * Format: HH:MM:SS.mmm or HH:MM:SS,mmm
 */
function parseTimestamp(timestamp: string): number {
  const normalized = timestamp.replace(",", ".");
  const parts = normalized.split(":");

  if (parts.length !== 3) {
    return 0;
  }

  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const secondsAndMs = parseFloat(parts[2]);

  return hours * 3600 + minutes * 60 + secondsAndMs;
}

/**
 * Extract speaker name from text content
 * Supports:
 * - <v Speaker Name>text
 * - Speaker Name: text
 */
function extractSpeaker(text: string): { speaker: string | null; cleanText: string } {
  // Check for <v SpeakerName> tag
  const vTagMatch = text.match(SPEAKER_V_TAG);
  if (vTagMatch) {
    const speaker = vTagMatch[1].trim();
    const cleanText = text.replace(/<v\s+[^>]+>/, "").replace(/<\/v>/g, "").trim();
    return { speaker, cleanText };
  }

  // Check for "Speaker: text" pattern
  const prefixMatch = text.match(SPEAKER_PREFIX);
  if (prefixMatch) {
    const speaker = prefixMatch[1].trim();
    const cleanText = text.replace(SPEAKER_PREFIX, "").trim();
    return { speaker, cleanText };
  }

  return { speaker: null, cleanText: text.trim() };
}

export function parseVTT(content: string, options: ParserOptions = {}): ParsedTranscript {
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

  // Validate VTT header (optional - some VTT files don't have it)
  let startIndex = 0;
  if (lines[0] && VTT_HEADER.test(lines[0].trim())) {
    startIndex = 1;
  }

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

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines - they separate cues
    if (!line) {
      flushSegment();
      continue;
    }

    // Skip cue identifiers (optional numeric IDs)
    if (/^\d+$/.test(line)) {
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

    // Skip NOTE and STYLE blocks
    if (line.startsWith("NOTE") || line.startsWith("STYLE")) {
      // Skip until empty line
      while (i + 1 < lines.length && lines[i + 1].trim()) {
        i++;
      }
      continue;
    }

    // Accumulate text content
    currentTextLines.push(line);
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
    format: "vtt",
  };
}
