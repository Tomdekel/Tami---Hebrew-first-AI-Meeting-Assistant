import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateEmbedding, cosineSimilarity } from "@/lib/ai/embeddings";

/**
 * POST /api/search/semantic
 * Semantic search across all user's session embeddings
 * - Supports entityTypes filter to narrow down to sessions with specific entity types
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const {
      query,
      sessionId,
      limit = 10,
      threshold = 0.3,
      entityTypes = [],
    } = await request.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Query is required" },
        { status: 400 }
      );
    }

    // If entity types filter is provided, get session IDs with matching entities
    let filteredSessionIds: string[] | null = null;
    if (Array.isArray(entityTypes) && entityTypes.length > 0) {
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
          results: [],
          query: query.trim(),
          totalMatches: 0,
        });
      }
    }

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query.trim());

    // Get embeddings from database
    let embeddingsQuery = supabase
      .from("memory_embeddings")
      .select(`
        id,
        session_id,
        content,
        embedding,
        metadata,
        sessions (
          id,
          title
        )
      `)
      .eq("user_id", user.id);

    // Filter by session if specified
    if (sessionId) {
      embeddingsQuery = embeddingsQuery.eq("session_id", sessionId);
    }

    // Filter by sessions that have matching entities
    if (filteredSessionIds) {
      embeddingsQuery = embeddingsQuery.in("session_id", filteredSessionIds);
    }

    const { data: embeddings, error } = await embeddingsQuery;

    if (error) {
      throw error;
    }

    if (!embeddings || embeddings.length === 0) {
      return NextResponse.json({
        results: [],
        query: query.trim(),
        message: "No embeddings found. Generate embeddings for your sessions first.",
      });
    }

    // Calculate similarities
    const results = embeddings
      .map((emb) => {
        const similarity = cosineSimilarity(
          queryEmbedding.embedding,
          emb.embedding as number[]
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sessionsData = emb.sessions as any;
        const session = Array.isArray(sessionsData)
          ? sessionsData[0]
          : sessionsData;
        const metadata = emb.metadata as {
          speakerName?: string;
          startTime?: number;
        } | null;

        return {
          id: emb.id,
          sessionId: emb.session_id,
          sessionTitle: session?.title || "Untitled",
          content: emb.content,
          speakerName: metadata?.speakerName || null,
          startTime: metadata?.startTime || null,
          similarity,
        };
      })
      .filter((r) => r.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return NextResponse.json({
      results,
      query: query.trim(),
      totalMatches: results.length,
    });
  } catch (error) {
    console.error("Semantic search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
