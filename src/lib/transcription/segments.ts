import type { TranscriptSegment } from "./types";

const DEFAULT_MAX_SPEAKERS = 2;
const TEXT_HASH_SEED = 5381;
const TIME_PRECISION = 1000;

type SegmentWithTimes =
  | { text: string; start: number; end: number }
  | { text: string; start_time: number; end_time: number };

function normalizeSegmentText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeSpeakerKey(speaker: string): string {
  return speaker
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ");
}

function hashText(text: string): string {
  let hash = TEXT_HASH_SEED;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) + hash) ^ text.charCodeAt(i);
  }
  return Math.abs(hash).toString(36);
}

function roundTime(value: number): number {
  return Math.round(value * TIME_PRECISION) / TIME_PRECISION;
}

function getSegmentTimes(segment: SegmentWithTimes): { start: number; end: number } {
  if ("start" in segment) {
    return { start: segment.start, end: segment.end };
  }
  return { start: segment.start_time, end: segment.end_time };
}

export function dedupeSegmentsByTimeAndText<T extends SegmentWithTimes>(segments: T[]): T[] {
  const seen = new Set<string>();
  const deduped: T[] = [];

  for (const segment of segments) {
    const { start, end } = getSegmentTimes(segment);
    const normalizedText = normalizeSegmentText(segment.text);
    const key = `${roundTime(start)}-${roundTime(end)}-${hashText(normalizedText)}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(segment);
  }

  return deduped;
}

export function normalizeSpeakerLabel(rawSpeaker: string, fallback = "Speaker 1"): string {
  const trimmed = rawSpeaker.trim();
  if (!trimmed) {
    return fallback;
  }

  const speakerMatch = trimmed.match(/speaker[_\s-]*0*(\d+)/i);
  if (!speakerMatch) {
    return trimmed;
  }

  const numericId = parseInt(speakerMatch[1], 10);
  const isZeroBased = /speaker_/i.test(trimmed);
  const speakerNumber = Math.max(1, numericId + (isZeroBased ? 1 : 0));
  return `Speaker ${speakerNumber}`;
}

export function capSpeakerCount(
  segments: TranscriptSegment[],
  maxSpeakers: number = DEFAULT_MAX_SPEAKERS
): TranscriptSegment[] {
  const normalized = segments.map((segment) => ({
    ...segment,
    speaker: normalizeSpeakerLabel(segment.speaker),
  }));
  const consolidated = normalized.map((segment) => ({
    ...segment,
    speaker: normalizeSpeakerKey(segment.speaker),
  }));
  const canonicalSpeakerMap = new Map<string, string>();
  for (const segment of normalized) {
    const key = normalizeSpeakerKey(segment.speaker);
    if (!canonicalSpeakerMap.has(key)) {
      canonicalSpeakerMap.set(key, segment.speaker);
    }
  }
  const merged = consolidated.map((segment) => ({
    ...segment,
    speaker: canonicalSpeakerMap.get(segment.speaker) ?? segment.speaker,
  }));

  if (maxSpeakers <= 0) {
    return merged;
  }

  const counts = new Map<string, number>();
  for (const segment of merged) {
    counts.set(segment.speaker, (counts.get(segment.speaker) ?? 0) + 1);
  }

  if (counts.size <= maxSpeakers) {
    return merged;
  }

  const sortedSpeakers = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([speaker]) => speaker);
  const allowedSpeakers = new Set(sortedSpeakers.slice(0, maxSpeakers));
  const fallbackSpeaker = sortedSpeakers[0] ?? "Speaker 1";

  return merged.map((segment) =>
    allowedSpeakers.has(segment.speaker)
      ? segment
      : { ...segment, speaker: fallbackSpeaker }
  );
}

export function normalizeTranscriptSegments(
  segments: TranscriptSegment[],
  options?: { maxSpeakers?: number }
): TranscriptSegment[] {
  const capped = capSpeakerCount(segments, options?.maxSpeakers);
  return dedupeSegmentsByTimeAndText(capped);
}
