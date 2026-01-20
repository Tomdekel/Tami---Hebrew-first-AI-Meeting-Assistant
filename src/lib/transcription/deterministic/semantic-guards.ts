/**
 * Deterministic ASR Refinement Pipeline - Semantic Guards
 *
 * Validates segments and flags potential issues before LLM polish.
 * Uses heuristic rules, not ML models.
 *
 * Goals:
 * - Catch potential hallucinations
 * - Flag speaker inconsistencies
 * - Identify repetition patterns
 * - Mark segments that need human review
 *
 * NON-GOALS (Explicit):
 * - Infer missing content
 * - Summarize content
 * - Rephrase for "clarity"
 * - Merge ideas across segments
 * - Generate creative language
 * - Add information not in original
 */

import type { DeterministicSegment, SemanticValidation, SemanticIssue } from "./types";

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Thresholds for various checks
 */
const THRESHOLDS = {
  /** Maximum reasonable segment length in tokens */
  MAX_SEGMENT_TOKENS: 200,
  /** Minimum segment length to be meaningful */
  MIN_MEANINGFUL_TOKENS: 3,
  /** Maximum repetition of same phrase */
  MAX_REPETITION_COUNT: 3,
  /** Similarity threshold for duplicate detection */
  DUPLICATE_SIMILARITY: 0.9,
};

// =============================================================================
// HALLUCINATION DETECTION PATTERNS
// =============================================================================

/**
 * Patterns that suggest ASR hallucination (not real speech)
 * Based on common Ivrit AI / Whisper hallucination patterns
 */
const HALLUCINATION_PATTERNS = [
  // Knesset opening phrases - HIGH PRIORITY (Ivrit AI trained on Knesset transcripts)
  /^תודה\s+רבה[,.]?\s*אדוני/u, // "תודה רבה, אדוני..." at segment start
  /אדוני\s+היושב[- ]ראש/u, // Knesset-style address
  /כבוד\s+ה?יושב[- ]ראש/u, // "כבוד (ה)יושב-ראש"
  /חברי\s+הכנסת\s+הנכבדים/u, // "חברי הכנסת הנכבדים"
  /חברי\s+הכנסת/u, // Knesset reference
  /חבר[ית]?\s+הכנסת/u, // Single Knesset member (male/female)
  /הדיון\s+הזה\s+נסגר/u, // "הדיון הזה נסגר" (debate closed)
  /ישיבת\s+הכנסת/u, // "ישיבת הכנסת" (Knesset session)
  // Excessive repetition (hallucination pattern)
  /תודה\s+רבה\s+תודה\s+רבה\s+תודה\s+רבה/u, // Excessive thanks repetition
  /שלום\s+שלום\s+שלום\s+שלום/u, // Excessive hello repetition
  // TV/Radio patterns
  /מהדורת\s+החדשות/u, // News broadcast
  /בשידור\s+חי/u, // Live broadcast
  /חזרו\s+לאחר\s+הפרסומות/u, // After commercials
  // Music/Audio bleeding
  /♪|♫|🎵/u, // Music notes
  /\[מוזיקה\]/u, // Music markers
  /\[שיר\]/u, // Song markers
  // Common Whisper artifacts
  /תודה\s+לצפייה/u, // Thanks for watching
  /הירשמו\s+לערוץ/u, // Subscribe to channel
  /לייק/u, // Like (YouTube style)
  /סאב/u, // Sub (YouTube style)
  // NOTE: Repetition detection moved to separate function to avoid ReDoS
];

/**
 * Safe repetition detection (avoids ReDoS)
 * Detects if the same phrase (10+ chars) appears 3+ times consecutively
 */
function detectRepeatingPhrase(text: string): { isRepetitive: boolean; phrase?: string } {
  // Limit input to prevent DoS
  const maxLength = 2000;
  const truncated = text.length > maxLength ? text.slice(0, maxLength) : text;

  const chunks = truncated.split(/\s+/).filter((c) => c.length > 0);
  if (chunks.length < 9) return { isRepetitive: false }; // Need at least 3 phrases of 3+ words

  // Check for 3+ consecutive identical phrases of varying lengths
  for (let phraseLen = 3; phraseLen <= Math.min(6, Math.floor(chunks.length / 3)); phraseLen++) {
    for (let start = 0; start <= chunks.length - phraseLen * 3; start++) {
      const phrase1 = chunks.slice(start, start + phraseLen).join(" ");
      const phrase2 = chunks.slice(start + phraseLen, start + phraseLen * 2).join(" ");
      const phrase3 = chunks.slice(start + phraseLen * 2, start + phraseLen * 3).join(" ");

      if (phrase1.length >= 10 && phrase1 === phrase2 && phrase2 === phrase3) {
        return { isRepetitive: true, phrase: phrase1 };
      }
    }
  }

  return { isRepetitive: false };
}

/**
 * Check if text matches hallucination patterns
 */
function hasHallucinationPattern(text: string): { matches: boolean; pattern?: string } {
  // Check regex patterns
  for (const pattern of HALLUCINATION_PATTERNS) {
    if (pattern.test(text)) {
      return { matches: true, pattern: pattern.source };
    }
  }

  // Check for repetitive phrases (separate function to avoid ReDoS)
  const repetition = detectRepeatingPhrase(text);
  if (repetition.isRepetitive) {
    return { matches: true, pattern: `Repeated phrase: ${repetition.phrase}` };
  }

  return { matches: false };
}

// =============================================================================
// REPETITION DETECTION
// =============================================================================

/**
 * Detect excessive repetition in text
 */
function detectRepetition(text: string): { isRepetitive: boolean; repeated?: string } {
  // Split into words
  const words = text.split(/\s+/);
  if (words.length < 6) return { isRepetitive: false };

  // Check for repeated phrases (3+ word sequences)
  for (let phraseLen = 3; phraseLen <= 6; phraseLen++) {
    const phrases = new Map<string, number>();

    for (let i = 0; i <= words.length - phraseLen; i++) {
      const phrase = words.slice(i, i + phraseLen).join(" ").toLowerCase();
      const count = (phrases.get(phrase) || 0) + 1;
      phrases.set(phrase, count);

      if (count >= THRESHOLDS.MAX_REPETITION_COUNT) {
        return { isRepetitive: true, repeated: phrase };
      }
    }
  }

  return { isRepetitive: false };
}

// =============================================================================
// SPEAKER CONSISTENCY
// =============================================================================

/**
 * Check for speaker consistency issues in a sequence of segments
 */
export function checkSpeakerConsistency(
  segments: DeterministicSegment[]
): Array<{ index: number; issue: string }> {
  const issues: Array<{ index: number; issue: string }> = [];

  // Track speaker patterns
  const speakerSegmentCounts = new Map<string, number>();
  for (const segment of segments) {
    const speaker = segment.speaker.toLowerCase();
    speakerSegmentCounts.set(speaker, (speakerSegmentCounts.get(speaker) || 0) + 1);
  }

  // Flag if too many unique speakers (likely attribution errors)
  if (speakerSegmentCounts.size > 5) {
    issues.push({
      index: -1,
      issue: `Too many unique speakers (${speakerSegmentCounts.size}), likely attribution errors`,
    });
  }

  // Check for rapid speaker switching (more than 3 switches in 5 segments)
  for (let i = 0; i < segments.length - 4; i++) {
    const windowSpeakers = segments.slice(i, i + 5).map((s) => s.speaker.toLowerCase());
    let switches = 0;
    for (let j = 1; j < windowSpeakers.length; j++) {
      if (windowSpeakers[j] !== windowSpeakers[j - 1]) switches++;
    }
    if (switches >= 4) {
      issues.push({
        index: i,
        issue: "Rapid speaker switching detected",
      });
    }
  }

  return issues;
}

// =============================================================================
// LENGTH ANOMALY DETECTION
// =============================================================================

/**
 * Detect segments with anomalous length
 */
function detectLengthAnomaly(segment: DeterministicSegment): SemanticIssue | null {
  const tokens = segment.tokenCount ?? segment.text.split(/\s+/).length;

  if (tokens > THRESHOLDS.MAX_SEGMENT_TOKENS) {
    return {
      type: "length_anomaly",
      severity: "medium",
      description: `Segment unusually long (${tokens} tokens)`,
      suggestion: "flag",
    };
  }

  if (tokens < THRESHOLDS.MIN_MEANINGFUL_TOKENS && segment.text.trim().length > 0) {
    // Check if it's just filler
    const fillerOnly = /^[\s.!?,;:'"()\-–—]+$/.test(segment.text);
    if (fillerOnly) {
      return {
        type: "length_anomaly",
        severity: "low",
        description: "Segment contains only punctuation/whitespace",
        suggestion: "delete",
      };
    }
  }

  return null;
}

// =============================================================================
// CONTENT MISMATCH DETECTION
// =============================================================================

/**
 * Detect segments that don't match expected conversational content
 */
function detectContentMismatch(segment: DeterministicSegment): SemanticIssue | null {
  const text = segment.text;

  // Check for hallucination patterns
  const hallucination = hasHallucinationPattern(text);
  if (hallucination.matches) {
    return {
      type: "possible_hallucination",
      severity: "high",
      description: `Possible ASR hallucination detected (pattern: ${hallucination.pattern?.slice(0, 30)})`,
      suggestion: "delete",
    };
  }

  // Check for excessive formality in casual context
  const formalPatterns = [
    /בכבוד\s+רב/u, // Respectfully
    /לכבוד\s+ה/u, // To the honorable
    /רציתי\s+להודות\s+לכם/u, // I wanted to thank you (formal)
  ];

  for (const pattern of formalPatterns) {
    if (pattern.test(text)) {
      return {
        type: "content_mismatch",
        severity: "low",
        description: "Unusually formal language for conversational context",
        suggestion: "flag",
      };
    }
  }

  return null;
}

// =============================================================================
// MAIN VALIDATION
// =============================================================================

/**
 * Validate a single segment
 */
export function validateSegment(segment: DeterministicSegment): SemanticValidation {
  const issues: SemanticIssue[] = [];

  // Check for length anomalies
  const lengthIssue = detectLengthAnomaly(segment);
  if (lengthIssue) issues.push(lengthIssue);

  // Check for content mismatch / hallucination
  const contentIssue = detectContentMismatch(segment);
  if (contentIssue) issues.push(contentIssue);

  // Check for repetition
  const repetition = detectRepetition(segment.text);
  if (repetition.isRepetitive) {
    issues.push({
      type: "repetition",
      severity: "medium",
      description: `Excessive repetition: "${repetition.repeated}"`,
      suggestion: "flag",
    });
  }

  // Calculate confidence
  const hasHighSeverity = issues.some((i) => i.severity === "high");
  const hasMediumSeverity = issues.some((i) => i.severity === "medium");

  let confidence = 1.0;
  if (hasHighSeverity) confidence = 0.3;
  else if (hasMediumSeverity) confidence = 0.6;
  else if (issues.length > 0) confidence = 0.8;

  return {
    valid: issues.length === 0 || !hasHighSeverity,
    issues,
    confidence,
  };
}

/**
 * Apply semantic guards to segments
 * Flags issues but doesn't delete - that's left to LLM polish or human review
 */
export function applySemanticGuardsToSegments(
  segments: DeterministicSegment[]
): {
  segments: DeterministicSegment[];
  flaggedCount: number;
  issues: Array<{ segmentIndex: number; issues: SemanticIssue[] }>;
} {
  let flaggedCount = 0;
  const allIssues: Array<{ segmentIndex: number; issues: SemanticIssue[] }> = [];

  const processedSegments = segments.map((segment, index) => {
    const validation = validateSegment(segment);

    if (validation.issues.length > 0) {
      flaggedCount++;
      allIssues.push({
        segmentIndex: index,
        issues: validation.issues,
      });

      // Add validation info to segment modifications
      return {
        ...segment,
        modifications: [
          ...(segment.modifications ?? []),
          ...validation.issues.map((issue) => ({
            rule: `semantic_guard:${issue.type}`,
            originalText: issue.description,
            timestamp: new Date(),
          })),
        ],
      };
    }

    return segment;
  });

  // Also check speaker consistency across all segments
  const speakerIssues = checkSpeakerConsistency(segments);
  if (speakerIssues.length > 0) {
    for (const issue of speakerIssues) {
      console.warn(`[Semantic Guard] Speaker issue: ${issue.issue}`);
    }
  }

  return {
    segments: processedSegments,
    flaggedCount,
    issues: allIssues,
  };
}

// =============================================================================
// DUPLICATE DETECTION (Cross-segment)
// =============================================================================

/**
 * Find near-duplicate segments
 */
export function findDuplicateSegments(
  segments: DeterministicSegment[]
): Array<{ indices: number[]; text: string }> {
  const duplicates: Array<{ indices: number[]; text: string }> = [];
  const seen = new Map<string, number[]>();

  for (let i = 0; i < segments.length; i++) {
    // Normalize text for comparison (use simple char class to avoid slow Unicode escapes)
    // Keeps: Latin letters, Hebrew letters, digits, whitespace
    const normalized = segments[i].text
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\u0590-\u05FF\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (normalized.length < 10) continue; // Skip very short segments

    const existing = seen.get(normalized);
    if (existing) {
      existing.push(i);
    } else {
      seen.set(normalized, [i]);
    }
  }

  // Filter to only duplicates (2+ occurrences)
  for (const [text, indices] of seen) {
    if (indices.length > 1) {
      duplicates.push({ indices, text });
    }
  }

  return duplicates;
}

/**
 * Check if a segment should be deleted due to high-severity hallucination.
 * Used by refine.ts to pre-filter hallucinations before faithful pipeline.
 *
 * Optimized: Uses direct pattern matching instead of full validation
 * to avoid unnecessary checks (length anomaly, repetition, etc.)
 *
 * @param text - Segment text to check
 * @returns true if the segment should be deleted
 */
export function shouldDeleteAsHallucination(text: string): boolean {
  // Direct pattern matching - skips full validateSegment for performance
  const hallucination = hasHallucinationPattern(text);
  return hallucination.matches;
}

/**
 * Get hallucination info for logging purposes.
 * Returns the matched pattern if it's a hallucination.
 */
export function getHallucinationInfo(text: string): {
  isHallucination: boolean;
  pattern?: string;
} {
  const result = hasHallucinationPattern(text);
  return {
    isHallucination: result.matches,
    pattern: result.pattern,
  };
}

/**
 * Generate validation report for debugging
 */
export function generateValidationReport(
  segments: DeterministicSegment[]
): string {
  const result = applySemanticGuardsToSegments(segments);
  const duplicates = findDuplicateSegments(segments);
  const speakerIssues = checkSpeakerConsistency(segments);

  const lines: string[] = [];
  lines.push("=== Semantic Validation Report ===");
  lines.push(`Total segments: ${segments.length}`);
  lines.push(`Flagged segments: ${result.flaggedCount}`);
  lines.push(`Duplicate groups: ${duplicates.length}`);
  lines.push(`Speaker issues: ${speakerIssues.length}`);
  lines.push("");

  if (result.issues.length > 0) {
    lines.push("Issues by segment:");
    for (const { segmentIndex, issues } of result.issues) {
      lines.push(`  [${segmentIndex}] ${issues.map((i) => `${i.severity}:${i.type}`).join(", ")}`);
    }
    lines.push("");
  }

  if (duplicates.length > 0) {
    lines.push("Duplicate segments:");
    for (const { indices, text } of duplicates) {
      lines.push(`  Indices ${indices.join(", ")}: "${text.slice(0, 50)}..."`);
    }
    lines.push("");
  }

  if (speakerIssues.length > 0) {
    lines.push("Speaker issues:");
    for (const issue of speakerIssues) {
      lines.push(`  [${issue.index}] ${issue.issue}`);
    }
  }

  return lines.join("\n");
}
