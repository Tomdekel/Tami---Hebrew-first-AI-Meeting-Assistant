import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { answerQuestionWithContext, type RetrievedContext, type TranscriptSegment } from "@/lib/ai/chat";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { dedupeSegmentsByTimeAndText } from "@/lib/transcription/segments";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const MAX_CONTEXT_CHUNKS = 10;
const SIMILARITY_THRESHOLD = 0.3;

// POST /api/sessions/[id]/chat - Ask a question about the meeting
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
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

  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  // Get the session with transcript
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*, transcripts(*, transcript_segments(*))")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Check if transcript exists
  const transcript = session.transcripts?.[0];
  if (!transcript || !transcript.transcript_segments?.length) {
    return NextResponse.json({ error: "No transcript available" }, { status: 400 });
  }

  try {
    // Save user question
    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      role: "user",
      content: question,
    });

    // Format segments for the AI
    const sortedSegments = transcript.transcript_segments.sort(
      (a: { segment_order: number }, b: { segment_order: number }) =>
        a.segment_order - b.segment_order
    );
    const dedupedSegments = dedupeSegmentsByTimeAndText(sortedSegments);
    const segments: TranscriptSegment[] = dedupedSegments.map(
      (seg: { speaker_name: string; speaker_id: string; text: string }) => ({
        speaker: seg.speaker_name || seg.speaker_id,
        text: seg.text,
      })
    );

    // Generate embedding for the question
    const questionEmbedding = await generateEmbedding(question);

    // Search for relevant context using vector similarity
    // This searches memory_embeddings which includes both transcript chunks and attachment chunks
    const { data: relevantChunks, error: searchError } = await supabase
      .rpc("match_embeddings", {
        query_embedding: questionEmbedding.embedding,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: MAX_CONTEXT_CHUNKS,
        p_session_id: sessionId,
      });

    let retrievedContext: RetrievedContext[] = [];

    if (!searchError && relevantChunks && relevantChunks.length > 0) {
      retrievedContext = relevantChunks.map((chunk: {
        content: string;
        metadata: {
          source_type?: string;
          attachment_name?: string;
        } | null;
        similarity: number;
      }) => ({
        content: chunk.content,
        sourceType: chunk.metadata?.source_type === "attachment" ? "attachment" as const : "transcript" as const,
        sourceName: chunk.metadata?.attachment_name,
        similarity: chunk.similarity,
      }));
    }

    // Get answer using RAG
    const answer = await answerQuestionWithContext(
      question,
      retrievedContext,
      segments,
      session.context || undefined,
      session.detected_language || "en"
    );

    // Save assistant response
    const { data: chatMessage } = await supabase
      .from("chat_messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        content: answer,
      })
      .select()
      .single();

    return NextResponse.json({
      answer,
      messageId: chatMessage?.id,
    });
  } catch (error) {
    console.error("Chat failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to answer question" },
      { status: 500 }
    );
  }
}

// GET /api/sessions/[id]/chat - Get chat history
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user owns the session
  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Get chat history
  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages });
}
