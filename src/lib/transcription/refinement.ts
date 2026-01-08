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
import type { TranscriptSegment, DeepRefinedSegment, DeepRefinementResult } from "./types";
import { SupabaseClient } from "@supabase/supabase-js";

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

// ============================================================================
// DEEP REFINEMENT - Comprehensive LLM-based transcript improvement
// ============================================================================

const DEEP_REFINEMENT_SYSTEM_PROMPT = `You are an expert transcription post-processor.

Your job is to receive a raw transcript (produced by automatic speech-to-text) and produce a clean, accurate, and readable version that can be used for note-taking, meeting summaries, and archiving.

YOU ARE ALLOWED TO:
- Fix transcription errors: typos, misheard words, broken sentences, repeated words that shouldn't repeat.
- Correct speaker attribution: Some sentences may be attributed to the wrong speaker. Use semantic context to reassign lines to a more plausible speaker.
- Replace generic speaker labels: If the transcript assigns labels like "Speaker 01" or "Speaker 1", you may replace them with the actual speaker's name if it appears during the meeting (e.g., when one person addresses another: "Thanks, Tom"). Only assign a real name if you're highly confident.
- Merge speakers: Sometimes the system mistakenly splits the same speaker into multiple labels (e.g., "Speaker 1", "Speaker 01", "Speaker A"). You should consolidate them if the context strongly suggests they are the same person.
- Delete hallucinated or incoherent segments: Some segments may be empty, gibberish, hallucinations (phrases repeated nonsensically), or background noise transcribed as words. These should be marked for soft deletion.
- Move sentences between speakers: If a sentence clearly belongs to another speaker (based on preceding context), reassign it.

YOU MUST:
- Preserve the original order of speech.
- NOT add any content that wasn't said.
- Maintain timestamps exactly as provided.
- Mark each segment with its action: "keep" (unchanged), "modified" (text or speaker changed), or "deleted" (should be hidden).

IMPORTANT RULES:
- If uncertain about a correction, prefer to keep the original.
- Real names should only be assigned if high confidence. Otherwise keep the generic label.
- Never delete content that might be meaningful.

OUTPUT FORMAT:
Return a valid JSON object with this structure:
{
  "segments": [
    {
      "speaker": "Speaker Name or Label",
      "timestamp": "MM:SS",
      "text": "Corrected sentence text",
      "originalIndex": 0,
      "action": "keep" | "modified" | "deleted"
    }
  ],
  "speakerMappings": {
    "Speaker 01": "Real Name (if identified)"
  }
}`;

export interface DeepRefinementContext {
  meetingContext?: string;
  language?: "he" | "en";
}

interface DBSegment {
  speaker_name: string | null;
  text: string;
  start_time: number;
  segment_order: number;
}

/**
 * Format seconds to MM:SS string
 */
function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Deep refinement: Send entire transcript to GPT-4o for comprehensive improvement
 *
 * This is more aggressive than the conservative segment-by-segment approach.
 * It can:
 * - Fix transcription errors
 * - Correct speaker attribution
 * - Merge speakers
 * - Delete hallucinated segments
 * - Replace generic labels with real names
 */
export async function deepRefineTranscript(
  segments: DBSegment[],
  context: DeepRefinementContext = {}
): Promise<DeepRefinementResult> {
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    console.warn("OpenAI API key not set, skipping deep refinement");
    return {
      segments: segments.map((s, i) => ({
        speaker: s.speaker_name || "Speaker",
        timestamp: formatTimestamp(s.start_time),
        text: s.text,
        originalIndex: i,
        action: "keep" as const,
      })),
      speakerMappings: {},
    };
  }

  const openai = new OpenAI({ apiKey: openaiKey });

  // Build the transcript text for the model
  const transcriptText = segments.map((seg, idx) => {
    const timestamp = formatTimestamp(seg.start_time);
    const speaker = seg.speaker_name || `Speaker ${idx % 10}`;
    return `[${idx}] ${timestamp} | ${speaker}: ${seg.text}`;
  }).join("\n");

  // Build context message
  let userMessage = `Here is a raw transcript to refine:\n\n${transcriptText}`;

  if (context.meetingContext) {
    userMessage = `Meeting context: ${context.meetingContext}\n\n${userMessage}`;
  }

  if (context.language) {
    userMessage += `\n\nLanguage: ${context.language === "he" ? "Hebrew" : "English"}`;
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: DEEP_REFINEMENT_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 16000, // Allow for large transcripts
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from GPT-4o");
    }

    const result = JSON.parse(content) as DeepRefinementResult;

    // Validate the result structure
    if (!Array.isArray(result.segments)) {
      throw new Error("Invalid response: segments is not an array");
    }

    // Ensure all segments have required fields
    const validatedSegments: DeepRefinedSegment[] = result.segments.map((seg, fallbackIdx) => ({
      speaker: seg.speaker || "Speaker",
      timestamp: seg.timestamp || "00:00",
      text: seg.text || "",
      originalIndex: typeof seg.originalIndex === "number" ? seg.originalIndex : fallbackIdx,
      action: seg.action || "keep",
    }));

    return {
      segments: validatedSegments,
      speakerMappings: result.speakerMappings || {},
    };
  } catch (error) {
    console.error("Deep refinement failed:", error);
    // Return original segments on failure
    return {
      segments: segments.map((s, i) => ({
        speaker: s.speaker_name || "Speaker",
        timestamp: formatTimestamp(s.start_time),
        text: s.text,
        originalIndex: i,
        action: "keep" as const,
      })),
      speakerMappings: {},
    };
  }
}

/**
 * Apply deep refinement results to database segments
 */
export async function applyDeepRefinements(
  supabase: SupabaseClient,
  transcriptId: string,
  result: DeepRefinementResult
): Promise<{ modifiedCount: number; deletedCount: number }> {
  let modifiedCount = 0;
  let deletedCount = 0;

  // Process each segment
  for (const segment of result.segments) {
    if (segment.action === "modified") {
      const { error } = await supabase
        .from("transcript_segments")
        .update({
          text: segment.text,
          speaker_name: segment.speaker,
        })
        .eq("transcript_id", transcriptId)
        .eq("segment_order", segment.originalIndex);

      if (!error) {
        modifiedCount++;
      } else {
        console.error(`Failed to update segment ${segment.originalIndex}:`, error);
      }
    }

    if (segment.action === "deleted") {
      const { error } = await supabase
        .from("transcript_segments")
        .update({ is_deleted: true })
        .eq("transcript_id", transcriptId)
        .eq("segment_order", segment.originalIndex);

      if (!error) {
        deletedCount++;
      } else {
        console.error(`Failed to delete segment ${segment.originalIndex}:`, error);
      }
    }
  }

  // Apply global speaker name mappings
  for (const [oldName, newName] of Object.entries(result.speakerMappings)) {
    if (oldName && newName && oldName !== newName) {
      await supabase
        .from("transcript_segments")
        .update({ speaker_name: newName })
        .eq("transcript_id", transcriptId)
        .eq("speaker_name", oldName);
    }
  }

  return { modifiedCount, deletedCount };
}
