import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/entities
 * Get all entities for the current user, grouped by type, with session links
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all entities for this user with their mentions
    const { data: entities, error } = await supabase
      .from("entities")
      .select(`
        id,
        type,
        value,
        normalized_value,
        mention_count,
        created_at,
        entity_mentions (
          session_id,
          context,
          sessions (
            id,
            title,
            created_at
          )
        )
      `)
      .eq("user_id", user.id)
      .order("mention_count", { ascending: false });

    if (error) {
      throw error;
    }

    // Format and group by type
    const groupedEntities: Record<string, Array<{
      id: string;
      value: string;
      normalizedValue: string;
      mentionCount: number;
      sessions: Array<{
        id: string;
        title: string | null;
        createdAt: string;
        context: string | null;
      }>;
    }>> = {};

    for (const entity of entities || []) {
      const type = entity.type;
      if (!groupedEntities[type]) {
        groupedEntities[type] = [];
      }

      // Get unique sessions for this entity
      const sessionsMap = new Map<string, {
        id: string;
        title: string | null;
        createdAt: string;
        context: string | null;
      }>();

      for (const mention of entity.entity_mentions || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const session = (mention as any).sessions;
        if (session && !sessionsMap.has(session.id)) {
          sessionsMap.set(session.id, {
            id: session.id,
            title: session.title,
            createdAt: session.created_at,
            context: mention.context,
          });
        }
      }

      groupedEntities[type].push({
        id: entity.id,
        value: entity.value,
        normalizedValue: entity.normalized_value,
        mentionCount: entity.mention_count,
        sessions: Array.from(sessionsMap.values()),
      });
    }

    // Calculate totals
    const totalEntities = entities?.length || 0;
    const typeCounts: Record<string, number> = {};
    for (const [type, items] of Object.entries(groupedEntities)) {
      typeCounts[type] = items.length;
    }

    return NextResponse.json({
      entities: groupedEntities,
      totalEntities,
      typeCounts,
    });
  } catch (error) {
    console.error("Get entities error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
