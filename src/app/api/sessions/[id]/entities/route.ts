import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractEntities } from "@/lib/ai/entities";
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

    // Get entity mentions for this session
    const { data: mentions, error } = await supabase
      .from("entity_mentions")
      .select(`
        id,
        context,
        entities (
          id,
          type,
          value,
          normalized_value,
          mention_count
        )
      `)
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
 * Extract entities from session transcript
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
      .select(`
        id,
        user_id,
        detected_language,
        transcripts (
          id,
          transcript_segments (
            speaker_id,
            speaker_name,
            text,
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
    if (!transcript?.transcript_segments?.length) {
      return NextResponse.json({ error: "No transcript found" }, { status: 400 });
    }

    // Format segments for extraction
    const sortedSegments = transcript.transcript_segments.sort(
      (a: { segment_order: number }, b: { segment_order: number }) =>
        a.segment_order - b.segment_order
    );
    const dedupedSegments = dedupeSegmentsByTimeAndText(sortedSegments);
    const segments = dedupedSegments.map(
      (seg: { speaker_name?: string; speaker_id: string; text: string }) => ({
        speaker: seg.speaker_name || seg.speaker_id,
        text: seg.text,
      })
    );

    // Extract entities
    const result = await extractEntities(
      segments,
      session.detected_language || "en"
    );

    // Save entities to database
    const savedEntities = [];

    for (const entity of result.entities) {
      // Check if entity already exists for this user
      const { data: existingEntity } = await supabase
        .from("entities")
        .select("id, mention_count")
        .eq("user_id", user.id)
        .eq("type", entity.type)
        .eq("normalized_value", entity.normalizedValue.toLowerCase())
        .single();

      let entityId: string;

      if (existingEntity) {
        // Update mention count
        entityId = existingEntity.id;
        await supabase
          .from("entities")
          .update({
            mention_count: existingEntity.mention_count + entity.mentions,
          })
          .eq("id", entityId);
      } else {
        // Create new entity
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

    return NextResponse.json({
      success: true,
      extractedCount: savedEntities.length,
      entities: savedEntities,
    });
  } catch (error) {
    console.error("Entity extraction error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
