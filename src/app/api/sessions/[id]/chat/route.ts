import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/ai/summarize";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Maximum segments to include in context (to avoid token limits)
// 250 segments * ~100 chars average = ~25k chars, well within GPT-4o-mini's context
const MAX_CONTEXT_SEGMENTS = 250;
const MAX_QUESTION_LENGTH = 2000;

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

  if (question.length > MAX_QUESTION_LENGTH) {
    return NextResponse.json({ error: `Question too long (max ${MAX_QUESTION_LENGTH} chars)` }, { status: 400 });
  }

  // Get session with transcript
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, title, context, detected_language, transcripts(id)")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const transcriptId = session.transcripts?.[0]?.id;
  if (!transcriptId) {
    return NextResponse.json({ error: "No transcript available" }, { status: 400 });
  }

  const language = session.detected_language === "he" ? "he" : "en";

  try {
    // Fetch all transcript segments for this meeting
    const { data: segments, error: segmentsError } = await supabase
      .from("transcript_segments")
      .select("speaker_name, speaker_id, text, segment_order")
      .eq("transcript_id", transcriptId)
      .order("segment_order", { ascending: true })
      .limit(MAX_CONTEXT_SEGMENTS);

    if (segmentsError) {
      throw new Error("Failed to load transcript");
    }

    if (!segments || segments.length === 0) {
      return NextResponse.json({
        answer: language === "he" ? "אין תמלול זמין לפגישה זו." : "No transcript available for this meeting.",
      });
    }

    // Format segments for the AI
    const formattedSegments = segments.map((seg) => ({
      speaker: seg.speaker_name || seg.speaker_id || "Unknown",
      text: seg.text,
    }));

    // Get a conversational answer using the full transcript as context
    const answer = await answerQuestion(
      question,
      formattedSegments,
      session.context || undefined,
      language
    );

    // Save the conversation to chat history
    await supabase.from("chat_messages").insert([
      { session_id: sessionId, role: "user", content: question },
      {
        session_id: sessionId,
        role: "assistant",
        content: answer,
      },
    ]);

    return NextResponse.json({ answer });
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

  const { data: session } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

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
