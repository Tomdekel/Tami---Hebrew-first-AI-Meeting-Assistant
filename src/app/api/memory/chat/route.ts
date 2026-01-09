import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { answerGlobalQuestion, type GlobalRetrievedContext } from "@/lib/ai/chat";
import { generateEmbedding } from "@/lib/ai/embeddings";

const MAX_CONTEXT_CHUNKS = 15;
const SIMILARITY_THRESHOLD = 0.25;

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
    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);

    // Convert embedding array to vector string format for pgvector
    const embeddingStr = `[${questionEmbedding.embedding.join(",")}]`;

    // Search for relevant context across ALL sessions using vector similarity
    const { data: relevantChunks, error: searchError } = await supabase
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

    // Get answer using Global RAG
    const { answer, sources } = await answerGlobalQuestion(
      question,
      retrievedContext,
      language
    );

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
