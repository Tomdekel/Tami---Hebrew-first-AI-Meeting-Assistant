import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { answerGlobalQuestion, answerPersonFilteredQuestion, type GlobalRetrievedContext } from "@/lib/ai/chat";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { parseQueryIntent, type ParsedQuery } from "@/lib/ai/query-parser";
import { SupabaseClient } from "@supabase/supabase-js";

const MAX_CONTEXT_CHUNKS = 15;
const MAX_CHUNKS_PER_SESSION = 3; // Limit per session for person queries
const SIMILARITY_THRESHOLD = 0.25;

/**
 * Escape special characters in LIKE/ILIKE patterns
 */
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, (char) => `\\${char}`);
}

async function resolvePersonIds(
  supabase: SupabaseClient,
  userId: string,
  personNames: string[]
): Promise<{ personIds: string[]; resolvedNames: Map<string, string> }> {
  const personIds: string[] = [];
  const resolvedNames = new Map<string, string>();

  for (const name of personNames) {
    const normalizedKey = name.toLowerCase().trim();
    // Limit name length to prevent abuse
    if (!normalizedKey || normalizedKey.length > 100) continue;

    // First try exact normalized_key match
    const { data: exactMatch } = await supabase
      .from("people")
      .select("id, display_name")
      .eq("user_id", userId)
      .eq("normalized_key", normalizedKey)
      .single();

    if (exactMatch) {
      personIds.push(exactMatch.id);
      resolvedNames.set(name, exactMatch.display_name);
      continue;
    }

    // Try partial match on display_name (escape special chars)
    const escapedKey = escapeLikePattern(normalizedKey);
    const { data: partialMatches } = await supabase
      .from("people")
      .select("id, display_name")
      .eq("user_id", userId)
      .ilike("display_name", `%${escapedKey}%`)
      .limit(1);

    if (partialMatches && partialMatches.length > 0) {
      personIds.push(partialMatches[0].id);
      resolvedNames.set(name, partialMatches[0].display_name);
      continue;
    }

    // Try alias match
    const { data: aliasMatches } = await supabase
      .from("people")
      .select("id, display_name, aliases")
      .eq("user_id", userId);

    if (aliasMatches) {
      for (const person of aliasMatches) {
        const aliases = person.aliases || [];
        if (aliases.some((alias: string) => alias.toLowerCase().includes(normalizedKey))) {
          personIds.push(person.id);
          resolvedNames.set(name, person.display_name);
          break;
        }
      }
    }
  }

  return { personIds, resolvedNames };
}

/**
 * Get sessions for given person IDs from session_people index
 */
async function getSessionsForPeople(
  supabase: SupabaseClient,
  personIds: string[]
): Promise<string[]> {
  if (personIds.length === 0) return [];

  const { data } = await supabase
    .from("session_people")
    .select("session_id")
    .in("person_id", personIds);

  return [...new Set((data || []).map((sp) => sp.session_id))];
}

// POST /api/memory/chat - Ask a question across all meetings
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { question } = body;
  // Validate language - whitelist to prevent unexpected values
  const language = body.language === "he" ? "he" : "en";

  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  // Validate question length to prevent excessive costs and DoS
  if (question.length > 5000) {
    return NextResponse.json({ error: "Question must be under 5000 characters" }, { status: 400 });
  }

  try {
    // Parse query to detect person-filter vs semantic
    const parsedQuery = parseQueryIntent(question);
    console.log("[memory/chat] Parsed query:", parsedQuery);

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);
    const embeddingStr = `[${questionEmbedding.embedding.join(",")}]`;

    let relevantChunks: Array<{
      id: string;
      session_id: string;
      content: string;
      metadata: {
        source_type?: string;
        attachment_name?: string;
        speakerName?: string;
        startTime?: number;
        person_id?: string;
      } | null;
      similarity: number;
    }> = [];
    let isPersonFiltered = false;
    let resolvedPersonNames: string[] = [];

    if (parsedQuery.type === "person_filter" && parsedQuery.personNames.length > 0) {
      // FILTER-FIRST RETRIEVAL: Resolve person and filter by sessions
      const { personIds, resolvedNames } = await resolvePersonIds(
        supabase,
        user.id,
        parsedQuery.personNames
      );

      resolvedPersonNames = Array.from(resolvedNames.values());

      if (personIds.length === 0) {
        // Person not found - DO NOT fallback to semantic search
        const notFoundMessage = language === "he"
          ? `לא מצאתי אדם בשם "${parsedQuery.personNames.join(", ")}" בפגישות שלך. נסה לבדוק את האיות או להשתמש בשם אחר.`
          : `I couldn't find a person named "${parsedQuery.personNames.join(", ")}" in your meetings. Try checking the spelling or using a different name.`;

        // Save message and return
        await supabase.from("memory_chat_messages").insert([
          { user_id: user.id, role: "user", content: question, sources: [] },
          { user_id: user.id, role: "assistant", content: notFoundMessage, sources: [] },
        ]);

        return NextResponse.json({
          answer: notFoundMessage,
          sources: [],
          totalChunksFound: 0,
          queryType: "person_filter",
          personNotFound: true,
        });
      }

      // Get sessions where this person appears
      const filteredSessionIds = await getSessionsForPeople(supabase, personIds);

      if (filteredSessionIds.length === 0) {
        // Person exists but has no associated sessions
        const noSessionsMessage = language === "he"
          ? `לא מצאתי פגישות עם ${resolvedPersonNames.join(", ")}. ייתכן שעדיין לא שייכת דוברים לאנשים בפגישות שלך.`
          : `I couldn't find any meetings with ${resolvedPersonNames.join(", ")}. You may need to assign speakers to people in your meetings first.`;

        await supabase.from("memory_chat_messages").insert([
          { user_id: user.id, role: "user", content: question, sources: [] },
          { user_id: user.id, role: "assistant", content: noSessionsMessage, sources: [] },
        ]);

        return NextResponse.json({
          answer: noSessionsMessage,
          sources: [],
          totalChunksFound: 0,
          queryType: "person_filter",
          noSessions: true,
        });
      }

      // Search ONLY within filtered sessions using search_embeddings_filtered
      const { data: filteredChunks, error: searchError } = await supabase
        .rpc("search_embeddings_filtered", {
          query_embedding: embeddingStr,
          filter_session_ids: filteredSessionIds,
          match_threshold: SIMILARITY_THRESHOLD,
          match_count: MAX_CONTEXT_CHUNKS,
          p_user_id: user.id,
        });

      if (searchError) {
        console.error("[memory/chat] Filtered search error:", searchError);
        // If function doesn't exist, fall back to regular search with manual filtering
        if (searchError.code === "42883") {
          console.log("[memory/chat] Using fallback filtering");
          const { data: allChunks } = await supabase
            .rpc("search_embeddings", {
              query_embedding: embeddingStr,
              match_threshold: SIMILARITY_THRESHOLD,
              match_count: MAX_CONTEXT_CHUNKS * 3, // Get more to filter
              p_user_id: user.id,
            });

          relevantChunks = (allChunks || []).filter(
            (c: { session_id: string }) => filteredSessionIds.includes(c.session_id)
          ).slice(0, MAX_CONTEXT_CHUNKS);
        } else {
          throw new Error("Failed to search embeddings");
        }
      } else {
        relevantChunks = filteredChunks || [];
      }

      isPersonFiltered = true;

      // Apply per-session cap for person queries
      const sessionChunkCounts = new Map<string, number>();
      relevantChunks = relevantChunks.filter((chunk) => {
        const count = sessionChunkCounts.get(chunk.session_id) || 0;
        if (count >= MAX_CHUNKS_PER_SESSION) return false;
        sessionChunkCounts.set(chunk.session_id, count + 1);
        return true;
      });

    } else {
      // SEMANTIC QUERY: Search across ALL sessions
      const { data: allChunks, error: searchError } = await supabase
        .rpc("search_embeddings", {
          query_embedding: embeddingStr,
          match_threshold: SIMILARITY_THRESHOLD,
          match_count: MAX_CONTEXT_CHUNKS,
          p_user_id: user.id,
        });

      if (searchError) {
        console.error("Search error:", searchError);
        throw new Error("Failed to search embeddings");
      }

      relevantChunks = allChunks || [];
    }

    // Get session details for the matching chunks
    const sessionIds = [...new Set((relevantChunks || []).map((c: { session_id: string }) => c.session_id))];

    let sessionsMap = new Map<string, { title: string; created_at: string }>();

    if (sessionIds.length > 0) {
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id, title, created_at")
        .in("id", sessionIds);

      if (sessions) {
        for (const session of sessions) {
          sessionsMap.set(session.id, {
            title: session.title || "Untitled Meeting",
            created_at: session.created_at,
          });
        }
      }
    }

    // Transform chunks to GlobalRetrievedContext format
    const retrievedContext: GlobalRetrievedContext[] = (relevantChunks || []).map((chunk: {
      id: string;
      session_id: string;
      content: string;
      metadata: {
        source_type?: string;
        attachment_name?: string;
        speakerName?: string;
        startTime?: number;
      } | null;
      similarity: number;
    }) => {
      const session = sessionsMap.get(chunk.session_id);
      const metadata = chunk.metadata || {};

      return {
        content: chunk.content,
        sourceType: metadata.source_type === "attachment" ? "attachment" as const : "transcript" as const,
        sourceName: metadata.attachment_name,
        sessionId: chunk.session_id,
        sessionTitle: session?.title || "Untitled Meeting",
        sessionDate: session?.created_at ? new Date(session.created_at).toLocaleDateString(language === "he" ? "he-IL" : "en-US") : undefined,
        speakerName: metadata.speakerName,
        startTime: metadata.startTime,
        similarity: chunk.similarity,
      };
    });

    // Get answer using appropriate function based on query type
    let answer: string;
    let sources: Array<{
      sessionId: string;
      sessionTitle: string;
      sessionDate?: string;
      excerpts: string[];
    }>;

    if (isPersonFiltered && resolvedPersonNames.length > 0) {
      // Use person-filtered answer with guardrails
      const result = await answerPersonFilteredQuestion(
        question,
        retrievedContext,
        resolvedPersonNames,
        language
      );
      answer = result.answer;
      sources = result.sources;
    } else {
      // Use standard global answer
      const result = await answerGlobalQuestion(
        question,
        retrievedContext,
        language
      );
      answer = result.answer;
      sources = result.sources;
    }

    // Save both user question and assistant answer to chat history
    const { error: insertError } = await supabase.from("memory_chat_messages").insert([
      {
        user_id: user.id,
        role: "user",
        content: question,
        sources: [],
      },
      {
        user_id: user.id,
        role: "assistant",
        content: answer,
        sources: sources,
      },
    ]);

    if (insertError) {
      // Log error but don't fail the request - user still got their answer
      console.error("Failed to save chat messages:", insertError);
    }

    return NextResponse.json({
      answer,
      sources,
      totalChunksFound: relevantChunks?.length || 0,
      queryType: parsedQuery.type,
      personNames: isPersonFiltered ? resolvedPersonNames : undefined,
    });
  } catch (error) {
    console.error("Global chat failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to answer question" },
      { status: 500 }
    );
  }
}

// GET /api/memory/chat - Get global chat history
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));

  try {
    const { data: messages, error } = await supabase
      .from("memory_chat_messages")
      .select("id, role, content, sources, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      messages: messages || [],
      total: messages?.length || 0,
    });
  } catch (error) {
    console.error("Failed to get chat history:", error);
    return NextResponse.json(
      { error: "Failed to get chat history" },
      { status: 500 }
    );
  }
}

// DELETE /api/memory/chat - Clear chat history
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { error } = await supabase
      .from("memory_chat_messages")
      .delete()
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear chat history:", error);
    return NextResponse.json(
      { error: "Failed to clear chat history" },
      { status: 500 }
    );
  }
}
