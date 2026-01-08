import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/search?q=query&sessionId=optional&entityTypes=person,organization
 * Search across transcripts
 * - If sessionId provided: search within that session
 * - If no sessionId: search across all user's sessions
 * - If entityTypes provided: filter to sessions containing those entity types
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");
    const sessionId = searchParams.get("sessionId");
    const entityTypesParam = searchParams.get("entityTypes");
    const limit = parseInt(searchParams.get("limit") || "50");

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse entity types filter
    const entityTypes = entityTypesParam
      ? entityTypesParam.split(",").filter(Boolean)
      : [];

    // If entity types filter is provided, get session IDs with matching entities
    let filteredSessionIds: string[] | null = null;
    if (entityTypes.length > 0) {
      const { data: entitySessions, error: entityError } = await supabase
        .from("entity_mentions")
        .select(`
          session_id,
          entities!inner (
            type,
            user_id
          )
        `)
        .eq("entities.user_id", user.id)
        .in("entities.type", entityTypes);

      if (entityError) {
        console.error("Entity filter error:", entityError);
        throw entityError;
      }

      // Get unique session IDs
      filteredSessionIds = [
        ...new Set((entitySessions || []).map((em) => em.session_id)),
      ];

      // If no sessions match the entity filter, return empty results
      if (filteredSessionIds.length === 0) {
        return NextResponse.json({
          query,
          totalResults: 0,
          results: sessionId ? [] : undefined,
          groupedResults: sessionId ? undefined : [],
        });
      }
    }

    // Build the query
    let dbQuery = supabase
      .from("transcript_segments")
      .select(`
        id,
        speaker_id,
        speaker_name,
        text,
        start_time,
        end_time,
        segment_order,
        transcripts!inner (
          id,
          sessions!inner (
            id,
            title,
            user_id,
            created_at
          )
        )
      `)
      .ilike("text", `%${query}%`)
      .eq("transcripts.sessions.user_id", user.id)
      .order("start_time", { ascending: true })
      .limit(limit);

    // Filter by session if provided
    if (sessionId) {
      dbQuery = dbQuery.eq("transcripts.sessions.id", sessionId);
    }

    // Filter by sessions that have matching entities
    if (filteredSessionIds) {
      dbQuery = dbQuery.in("transcripts.sessions.id", filteredSessionIds);
    }

    const { data: results, error } = await dbQuery;

    if (error) {
      console.error("Search error:", error);
      throw error;
    }

    // Format results
    const formattedResults = (results || []).map((segment) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const transcripts = segment.transcripts as any;
      const session = Array.isArray(transcripts?.sessions)
        ? transcripts.sessions[0]
        : transcripts?.sessions;
      return {
        segmentId: segment.id,
        sessionId: session?.id || "",
        sessionTitle: session?.title || "",
        sessionDate: session?.created_at || "",
        speakerId: segment.speaker_id,
        speakerName: segment.speaker_name || segment.speaker_id,
        text: segment.text,
        startTime: segment.start_time,
        endTime: segment.end_time,
        // Highlight the matching text
        highlightedText: highlightMatch(segment.text, query),
      };
    });

    // Group by session for global search
    const groupedBySession = !sessionId
      ? groupResultsBySession(formattedResults)
      : null;

    return NextResponse.json({
      query,
      totalResults: formattedResults.length,
      results: sessionId ? formattedResults : undefined,
      groupedResults: groupedBySession,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Highlight matching text with markers
 */
function highlightMatch(text: string, query: string): string {
  const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
  return text.replace(regex, "**$1**");
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Group search results by session
 */
function groupResultsBySession(
  results: Array<{
    sessionId: string;
    sessionTitle: string;
    sessionDate: string;
    segmentId: string;
    speakerId: string;
    speakerName: string;
    text: string;
    startTime: number;
    endTime: number;
    highlightedText: string;
  }>
) {
  const groups = new Map<
    string,
    {
      sessionId: string;
      sessionTitle: string;
      sessionDate: string;
      matchCount: number;
      matches: Array<{
        segmentId: string;
        speakerName: string;
        text: string;
        highlightedText: string;
        startTime: number;
      }>;
    }
  >();

  for (const result of results) {
    if (!groups.has(result.sessionId)) {
      groups.set(result.sessionId, {
        sessionId: result.sessionId,
        sessionTitle: result.sessionTitle,
        sessionDate: result.sessionDate,
        matchCount: 0,
        matches: [],
      });
    }

    const group = groups.get(result.sessionId)!;
    group.matchCount++;
    group.matches.push({
      segmentId: result.segmentId,
      speakerName: result.speakerName,
      text: result.text,
      highlightedText: result.highlightedText,
      startTime: result.startTime,
    });
  }

  return Array.from(groups.values()).sort(
    (a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime()
  );
}
