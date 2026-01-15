import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractEntities } from "@/lib/ai/entities";
import {
  extractEntitiesWithGrounding,
  checkLangExtractHealth,
} from "@/lib/ai/langextract-client";
import { dedupeSegmentsByTimeAndText } from "@/lib/transcription/segments";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id]/entities
 * Get extracted entities for a session
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get session to verify ownership
    const { data: session } = await supabase
      .from("sessions")
      .select("id, user_id")
      .eq("id", id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get entity mentions for this session with grounding info
    const { data: mentions, error } = await supabase
      .from("entity_mentions")
      .select(
        `
        id,
        context,
        start_offset,
        end_offset,
        confidence,
        entities (
          id,
          type,
          value,
          normalized_value,
          mention_count
        )
      `
      )
      .eq("session_id", id);

    if (error) {
      throw error;
    }

    // Format response
    const entities = (mentions || []).map((mention) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const entitiesData = mention.entities as any;
      const entity = Array.isArray(entitiesData)
        ? entitiesData[0]
        : entitiesData;
      return {
        id: entity?.id || "",
        type: entity?.type || "",
        value: entity?.value || "",
        normalizedValue: entity?.normalized_value || "",
        mentionCount: entity?.mention_count || 0,
        context: mention.context,
        startOffset: mention.start_offset,
        endOffset: mention.end_offset,
        confidence: mention.confidence,
      };
    });

    return NextResponse.json({ entities });
  } catch (error) {
    console.error("Get entities error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]/entities
 * Extract entities from session transcript using LangExtract (with legacy fallback)
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get session with transcript
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select(
        `
        id,
        user_id,
        detected_language,
        transcripts (
          id,
          transcript_segments (
            speaker_id,
            speaker_name,
            text,
            segment_order,
            start_time,
            end_time
          )
        )
      `
      )
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
      return NextResponse.json(
        { error: "No transcript found" },
        { status: 400 }
      );
    }

    // Format segments for extraction
    const sortedSegments = transcript.transcript_segments.sort(
      (a: { segment_order: number }, b: { segment_order: number }) =>
        a.segment_order - b.segment_order
    );
    // Cast to include time fields for deduplication (select includes all fields)
    const segmentsWithTimes = sortedSegments as Array<{
      text: string;
      start_time: number;
      end_time: number;
      speaker_name?: string;
      speaker_id: string;
    }>;
    const dedupedSegments = dedupeSegmentsByTimeAndText(segmentsWithTimes);
    const segments: { speaker: string; text: string }[] = dedupedSegments.map(
      (seg) => ({
        speaker: seg.speaker_name || seg.speaker_id,
        text: seg.text,
      })
    );

    // Also include summary content for entity extraction (user may edit summaries with new info)
    const { data: summaryData } = await supabase
      .from("summaries")
      .select("overview, key_points, decisions, notes")
      .eq("session_id", id)
      .single();

    if (summaryData) {
      if (summaryData.overview?.trim()) {
        segments.push({ speaker: "Summary", text: summaryData.overview });
      }
      if (summaryData.key_points?.trim()) {
        segments.push({ speaker: "Key Points", text: summaryData.key_points });
      }
      if (summaryData.decisions?.trim()) {
        segments.push({ speaker: "Decisions", text: summaryData.decisions });
      }
      if (summaryData.notes?.trim()) {
        segments.push({ speaker: "Notes", text: summaryData.notes });
      }
    }

    // Format transcript for LangExtract
    const transcriptText = segments
      .map((s) => `${s.speaker}: ${s.text}`)
      .join("\n");
    const language = session.detected_language || "en";

    // Check if LangExtract is available
    const langExtractAvailable = await checkLangExtractHealth();
    const savedEntities = [];
    let usedLangExtract = false;

    if (langExtractAvailable) {
      // Use LangExtract with source grounding
      console.log("[api:entities] Using LangExtract service");
      usedLangExtract = true;

      try {
        const result = await extractEntitiesWithGrounding(
          transcriptText,
          language
        );

        for (const entity of result.entities) {
          // Use cross-type deduplication by normalized_value
          const { data: existingEntity } = await supabase
            .from("entities")
            .select("id, mention_count")
            .eq("user_id", user.id)
            .eq("normalized_value", entity.normalized_value)
            .single();

          let entityId: string;

          if (existingEntity) {
            entityId = existingEntity.id;
            await supabase
              .from("entities")
              .update({
                mention_count: existingEntity.mention_count + 1,
              })
              .eq("id", entityId);
          } else {
            const { data: newEntity, error: createError } = await supabase
              .from("entities")
              .insert({
                user_id: user.id,
                type: entity.type,
                value: entity.value,
                normalized_value: entity.normalized_value,
                mention_count: 1,
              })
              .select("id")
              .single();

            if (createError) {
              console.error("Failed to create entity:", createError);
              continue;
            }
            entityId = newEntity.id;
          }

          // Create entity mention with grounding info
          await supabase.from("entity_mentions").insert({
            entity_id: entityId,
            session_id: id,
            context: entity.source_text,
            start_offset: entity.start_offset,
            end_offset: entity.end_offset,
            confidence: entity.confidence,
          });

          savedEntities.push({
            id: entityId,
            type: entity.type,
            value: entity.value,
            normalizedValue: entity.normalized_value,
            mentions: 1,
            context: entity.source_text,
            confidence: entity.confidence,
          });
        }
      } catch (langExtractError) {
        console.error(
          "[api:entities] LangExtract failed, falling back to legacy:",
          langExtractError
        );
        usedLangExtract = false;
      }
    }

    // Fallback to legacy extraction
    if (!usedLangExtract) {
      console.log("[api:entities] Using legacy GPT extraction");

      const result = await extractEntities(segments, language);

      for (const entity of result.entities) {
        // Check if entity already exists (cross-type by normalized_value)
        const { data: existingEntity } = await supabase
          .from("entities")
          .select("id, mention_count")
          .eq("user_id", user.id)
          .eq("normalized_value", entity.normalizedValue.toLowerCase())
          .single();

        let entityId: string;

        if (existingEntity) {
          entityId = existingEntity.id;
          await supabase
            .from("entities")
            .update({
              mention_count: existingEntity.mention_count + entity.mentions,
            })
            .eq("id", entityId);
        } else {
          const { data: newEntity, error: createError } = await supabase
            .from("entities")
            .insert({
              user_id: user.id,
              type: entity.type,
              value: entity.value,
              normalized_value: entity.normalizedValue.toLowerCase(),
              mention_count: entity.mentions,
            })
            .select("id")
            .single();

          if (createError) {
            console.error("Failed to create entity:", createError);
            continue;
          }
          entityId = newEntity.id;
        }

        // Create entity mention for this session
        await supabase.from("entity_mentions").insert({
          entity_id: entityId,
          session_id: id,
          context: entity.context,
        });

        savedEntities.push({
          id: entityId,
          type: entity.type,
          value: entity.value,
          normalizedValue: entity.normalizedValue,
          mentions: entity.mentions,
          context: entity.context,
        });
      }
    }

    return NextResponse.json({
      success: true,
      extractedCount: savedEntities.length,
      entities: savedEntities,
      usedLangExtract,
    });
  } catch (error) {
    console.error("Entity extraction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
