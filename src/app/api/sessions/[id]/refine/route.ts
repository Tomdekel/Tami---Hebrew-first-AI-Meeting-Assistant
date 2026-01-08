import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  refineTranscript,
  lightRefine,
  deepRefineTranscript,
  applyDeepRefinements,
  type RefinementContext
} from "@/lib/transcription/refinement";
import type { TranscriptSegment } from "@/lib/transcription/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/sessions/[id]/refine
 * Refine transcript with GPT-4o correction
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get session with transcript
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(`
        id,
        user_id,
        context,
        detected_language,
        transcripts (
          id,
          transcript_segments (
            id,
            speaker_id,
            speaker_name,
            text,
            start_time,
            end_time,
            segment_order
          )
        )
      `)
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const transcript = session.transcripts?.[0];
    if (!transcript || !transcript.transcript_segments?.length) {
      return NextResponse.json({ error: "No transcript found" }, { status: 400 });
    }

    // Parse request body for refinement options
    const body = await request.json().catch(() => ({}));
    const { mode = "deep", participantNames, terminology } = body as {
      mode?: "deep" | "full" | "light";
      participantNames?: string[];
      terminology?: string[];
    };

    // For deep mode, use the new comprehensive refinement
    if (mode === "deep") {
      // Prepare segments for deep refinement
      const dbSegments = transcript.transcript_segments.map(
        (seg: {
          id: string;
          speaker_id: string;
          speaker_name?: string;
          text: string;
          start_time: number;
          end_time: number;
          segment_order: number;
        }) => ({
          speaker_name: seg.speaker_name || seg.speaker_id,
          text: seg.text,
          start_time: seg.start_time,
          segment_order: seg.segment_order,
        })
      );

      // Run deep refinement with GPT-4o
      console.log(`[Refine] Starting deep refinement for transcript ${transcript.id} with ${dbSegments.length} segments`);

      const refinementResult = await deepRefineTranscript(dbSegments, {
        meetingContext: session.context || undefined,
        language: (session.detected_language as "he" | "en") || "he",
      });

      // Log what GPT-4o returned
      const actionCounts = refinementResult.segments.reduce((acc, seg) => {
        acc[seg.action] = (acc[seg.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      console.log(`[Refine] GPT-4o returned ${refinementResult.segments.length} segments:`, actionCounts);
      console.log(`[Refine] Speaker mappings:`, refinementResult.speakerMappings);

      // Log first few modified segments for debugging
      const modifiedSamples = refinementResult.segments
        .filter(s => s.action === "modified")
        .slice(0, 3);
      if (modifiedSamples.length > 0) {
        console.log(`[Refine] Sample modified segments:`, JSON.stringify(modifiedSamples, null, 2));
      }

      // Apply refinements to database
      const { modifiedCount, deletedCount } = await applyDeepRefinements(
        supabase,
        transcript.id,
        refinementResult
      );

      return NextResponse.json({
        success: true,
        modifiedCount,
        deletedCount,
        totalSegments: transcript.transcript_segments.length,
        speakerMappings: refinementResult.speakerMappings,
        actionCounts, // Include for debugging
        mode,
      });
    }

    // Legacy modes: light and full (conservative)
    const segments: TranscriptSegment[] = transcript.transcript_segments.map(
      (seg: {
        id: string;
        speaker_id: string;
        speaker_name?: string;
        text: string;
        start_time: number;
        end_time: number;
        segment_order: number;
      }) => ({
        speaker: seg.speaker_id,
        speakerName: seg.speaker_name,
        text: seg.text,
        start: seg.start_time,
        end: seg.end_time,
        segmentOrder: seg.segment_order,
      })
    );

    let refinedSegments: TranscriptSegment[];
    let refinedCount = 0;

    if (mode === "light") {
      // Quick rule-based refinement
      refinedSegments = lightRefine(segments);
      refinedCount = segments.filter(
        (s, i) => s.text !== refinedSegments[i].text
      ).length;
    } else {
      // Full GPT-4o-mini refinement (conservative, segment-by-segment)
      const context: RefinementContext = {
        meetingContext: session.context || undefined,
        language: (session.detected_language as "he" | "en") || "he",
        participantNames,
        terminology,
      };

      const result = await refineTranscript(segments, context);
      refinedSegments = result.segments;
      refinedCount = result.refinedCount;
    }

    // Update segments in database
    for (let i = 0; i < refinedSegments.length; i++) {
      const original = transcript.transcript_segments[i];
      const refined = refinedSegments[i];

      // Only update if text changed
      if (original.text !== refined.text) {
        await supabase
          .from("transcript_segments")
          .update({
            text: refined.text,
            original_text: original.text, // Store original
          })
          .eq("id", original.id);
      }
    }

    return NextResponse.json({
      success: true,
      refinedCount,
      totalSegments: segments.length,
      mode,
    });
  } catch (error) {
    console.error("Refinement error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]/refine
 * Revert to original transcript
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(`
        id,
        user_id,
        transcripts (
          id,
          transcript_segments (
            id,
            text,
            original_text,
            is_deleted
          )
        )
      `)
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const transcript = session.transcripts?.[0];
    if (!transcript?.transcript_segments?.length) {
      return NextResponse.json({ error: "No transcript found" }, { status: 400 });
    }

    // Revert segments that have original_text and reset is_deleted
    let revertedCount = 0;
    for (const segment of transcript.transcript_segments) {
      const needsRevert = segment.original_text && segment.original_text !== segment.text;
      const needsUndelete = segment.is_deleted === true;

      if (needsRevert || needsUndelete) {
        await supabase
          .from("transcript_segments")
          .update({
            text: needsRevert ? segment.original_text : segment.text,
            original_text: null,
            is_deleted: false,
          })
          .eq("id", segment.id);
        revertedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      revertedCount,
    });
  } catch (error) {
    console.error("Revert error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
