/**
 * Transcript Refinement Service
 *
 * IMPORTANT: This is a conservative refinement approach based on lessons from Tami v1.
 * Full LLM rewriting corrupted transcripts (deleted content, wrong speakers, hallucinations).
 *
 * This service:
 * - Processes segments individually to preserve structure
 * - NEVER changes speaker assignments
 * - NEVER changes timestamps
 * - Only fixes spelling, terminology, and minor errors
 * - Keeps original text as backup
 */

import OpenAI from "openai";
import type { TranscriptSegment } from "./types";

export interface RefinementContext {
  meetingContext?: string; // e.g., "Product meeting at tech company"
  participantNames?: string[]; // Known participant names for correction
  terminology?: string[]; // Domain-specific terms
  language?: "he" | "en";
}

export interface RefinedSegment extends TranscriptSegment {
  originalText: string; // Preserved original
  wasRefined: boolean;
  refinementNotes?: string;
}

export interface RefinementResult {
  segments: RefinedSegment[];
  refinedCount: number;
  totalSegments: number;
}

const REFINEMENT_SYSTEM_PROMPT = `You are a transcript correction assistant. Your job is to fix MINOR errors in transcribed speech segments.

CRITICAL RULES:
1. NEVER change the meaning or add new content
2. NEVER delete sentences or significant parts
3. ONLY fix:
   - Obvious spelling mistakes
   - Common transcription errors (homophones, mishearings)
   - Punctuation and capitalization
   - Name spelling (if provided in context)
4. If unsure, keep the original text
5. Preserve the speaker's voice and style
6. Return ONLY the corrected text, nothing else

For Hebrew text:
- Fix common Hebrew spelling errors
- Correct nikud if present
- Fix Hebrew-English transliteration issues`;

/**
 * Refine transcript segments using GPT-4o
 * Conservative approach: segment-by-segment, preserving structure
 */
export async function refineTranscript(
  segments: TranscriptSegment[],
  context: RefinementContext = {}
): Promise<RefinementResult> {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    console.warn("OpenAI API key not set, skipping refinement");
    return {
      segments: segments.map((s) => ({
        ...s,
        originalText: s.text,
        wasRefined: false,
      })),
      refinedCount: 0,
      totalSegments: segments.length,
    };
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  // Build context string for the model
  const contextParts: string[] = [];
  if (context.meetingContext) {
    contextParts.push(`Meeting context: ${context.meetingContext}`);
  }
  if (context.participantNames?.length) {
    contextParts.push(`Participant names (correct spelling): ${context.participantNames.join(", ")}`);
  }
  if (context.terminology?.length) {
    contextParts.push(`Domain terminology: ${context.terminology.join(", ")}`);
  }

  const contextString = contextParts.length > 0
    ? `\n\nContext:\n${contextParts.join("\n")}`
    : "";

  const refinedSegments: RefinedSegment[] = [];
  let refinedCount = 0;

  // Process segments in batches for efficiency
  const batchSize = 10;

  for (let i = 0; i < segments.length; i += batchSize) {
    const batch = segments.slice(i, i + batchSize);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (segment) => {
        // Skip very short segments (likely noise)
        if (segment.text.trim().length < 3) {
          return {
            ...segment,
            originalText: segment.text,
            wasRefined: false,
          };
        }

        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: REFINEMENT_SYSTEM_PROMPT + contextString,
              },
              {
                role: "user",
                content: `Correct any errors in this transcript segment. Language: ${context.language || "auto-detect"}\n\nOriginal: "${segment.text}"`,
              },
            ],
            temperature: 0.1, // Low temperature for consistency
            max_tokens: segment.text.length * 2, // Limit output length
          });

          const refinedText = response.choices[0]?.message?.content?.trim() || segment.text;

          // Check if text was actually changed
          const wasChanged = refinedText !== segment.text &&
            refinedText.length > 0 &&
            refinedText.length < segment.text.length * 1.5; // Sanity check

          if (wasChanged) {
            refinedCount++;
          }

          return {
            ...segment,
            text: wasChanged ? refinedText : segment.text,
            originalText: segment.text,
            wasRefined: wasChanged,
          };
        } catch (error) {
          console.error(`Refinement failed for segment ${segment.segmentOrder}:`, error);
          // On error, keep original
          return {
            ...segment,
            originalText: segment.text,
            wasRefined: false,
            refinementNotes: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
          };
        }
      })
    );

    refinedSegments.push(...batchResults);
  }

  return {
    segments: refinedSegments,
    refinedCount,
    totalSegments: segments.length,
  };
}

/**
 * Apply simple rule-based corrections (no LLM)
 * Safe to use on any transcript
 */
export function applyRuleBasedCorrections(text: string): string {
  let corrected = text;

  // Hebrew filler word removal
  const hebrewFillers = [
    /\bאהה+\b/g, // ehh
    /\bאממ+\b/g, // umm
    /\bכאילו\s+כאילו\b/g, // like like -> like
    /\bזאת אומרת\s+זאת אומרת\b/g, // I mean I mean -> I mean
  ];

  for (const pattern of hebrewFillers) {
    corrected = corrected.replace(pattern, "");
  }

  // English filler word reduction (don't remove, just reduce repetition)
  const englishFillers = [
    /\b(um|uh|er|ah)\s+\1+\b/gi, // repeated fillers
    /\b(you know)\s+(you know)\b/gi, // you know you know
    /\b(like)\s+(like)\b/gi, // like like
  ];

  for (const pattern of englishFillers) {
    corrected = corrected.replace(pattern, "$1");
  }

  // Clean up extra whitespace
  corrected = corrected.replace(/\s+/g, " ").trim();

  return corrected;
}

/**
 * Light refinement: rule-based only, no LLM
 * Use this for immediate display, then optionally refine with LLM in background
 */
export function lightRefine(segments: TranscriptSegment[]): TranscriptSegment[] {
  return segments.map((segment) => ({
    ...segment,
    text: applyRuleBasedCorrections(segment.text),
  }));
}
