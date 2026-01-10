import { SupabaseClient } from "@supabase/supabase-js";
import { generateSummary } from "./summarize";

interface Segment {
  speaker_name: string;
  speaker_id: string;
  text: string;
  segment_order: number;
  is_deleted?: boolean;
}

/**
 * Automatically generate and save a summary for a session.
 * This is called after transcription completes.
 * If a summary already exists, it will skip generation.
 */
export async function generateAndSaveSummary(
  supabase: SupabaseClient,
  sessionId: string,
  userId: string,
  options?: {
    context?: string;
    language?: string;
    transcriptId?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if summary already exists
    const { data: existingSummary } = await supabase
      .from("summaries")
      .select("id")
      .eq("session_id", sessionId)
      .single();

    if (existingSummary) {
      console.log(`Summary already exists for session ${sessionId}, skipping`);
      return { success: true };
    }

    // Get transcript segments
    let transcriptId = options?.transcriptId;

    if (!transcriptId) {
      const { data: transcript } = await supabase
        .from("transcripts")
        .select("id")
        .eq("session_id", sessionId)
        .single();

      transcriptId = transcript?.id;
    }

    if (!transcriptId) {
      return { success: false, error: "No transcript found" };
    }

    const { data: dbSegments } = await supabase
      .from("transcript_segments")
      .select("speaker_name, speaker_id, text, segment_order, is_deleted")
      .eq("transcript_id", transcriptId)
      .order("segment_order");

    if (!dbSegments || dbSegments.length === 0) {
      return { success: false, error: "No transcript segments found" };
    }

    // Filter out deleted segments and format for AI
    const segments = (dbSegments as Segment[])
      .filter((seg) => !seg.is_deleted)
      .sort((a, b) => a.segment_order - b.segment_order)
      .map((seg) => ({
        speaker: seg.speaker_name || seg.speaker_id,
        text: seg.text,
      }));

    if (segments.length === 0) {
      return { success: false, error: "No valid segments after filtering" };
    }

    // Generate summary
    const summaryResult = await generateSummary(
      segments,
      options?.context,
      options?.language || "en"
    );

    // Save summary with notes
    const { data: summary, error: summaryError } = await supabase
      .from("summaries")
      .insert({
        session_id: sessionId,
        overview: summaryResult.overview,
        key_points: summaryResult.keyPoints,
        decisions: summaryResult.decisions,
        notes: summaryResult.notes, // New timestamped sections
      })
      .select()
      .single();

    if (summaryError) {
      throw new Error(`Failed to save summary: ${summaryError.message}`);
    }

    // Save action items
    if (summaryResult.actionItems.length > 0) {
      const actionItems = summaryResult.actionItems.map((item) => ({
        summary_id: summary.id,
        description: item.description,
        assignee: item.assignee,
        deadline: item.deadline,
        completed: false,
      }));

      const { error: actionError } = await supabase
        .from("action_items")
        .insert(actionItems);

      if (actionError) {
        console.error("Failed to save action items:", actionError);
      }
    }

    // Save topics as auto-generated tags
    if (summaryResult.topics.length > 0) {
      for (const topic of summaryResult.topics) {
        // Create or get tag
        const { data: existingTag } = await supabase
          .from("tags")
          .select("id")
          .eq("user_id", userId)
          .eq("name", topic)
          .single();

        let tagId = existingTag?.id;

        if (!tagId) {
          const { data: newTag } = await supabase
            .from("tags")
            .insert({
              user_id: userId,
              name: topic,
              color: "#6366f1", // Default indigo
              source: "auto:topic",
              is_visible: true,
            })
            .select("id")
            .single();
          tagId = newTag?.id;
        }

        if (tagId) {
          // Link tag to session
          await supabase
            .from("session_tags")
            .upsert({ session_id: sessionId, tag_id: tagId });
        }
      }
    }

    console.log(`Auto-summary generated for session ${sessionId}`);
    return { success: true };
  } catch (error) {
    console.error("Auto-summary generation failed:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
