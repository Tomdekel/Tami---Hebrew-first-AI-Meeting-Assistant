import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generateEmbeddings,
  chunkTranscriptForEmbedding,
} from "@/lib/ai/embeddings";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id]/embeddings
 * Get embedding status for a session
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

    // Verify session ownership
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

    // Get embedding count
    const { count, error } = await supabase
      .from("memory_embeddings")
      .select("id", { count: "exact", head: true })
      .eq("session_id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      sessionId: id,
      embeddingCount: count || 0,
      hasEmbeddings: (count || 0) > 0,
    });
  } catch (error) {
    console.error("Get embeddings status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]/embeddings
 * Generate embeddings for a session's transcript
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
        title,
        transcripts (
          id,
          transcript_segments (
            speaker_id,
            speaker_name,
            text,
            start_time,
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

    // Delete existing embeddings for this session
    await supabase.from("memory_embeddings").delete().eq("session_id", id);

    // Sort segments and prepare for chunking
    const sortedSegments = transcript.transcript_segments
      .sort(
        (
          a: { segment_order: number },
          b: { segment_order: number }
        ) => a.segment_order - b.segment_order
      )
      .map(
        (seg: {
          speaker_id: string;
          speaker_name?: string;
          text: string;
          start_time?: number;
        }) => ({
          speakerId: seg.speaker_id,
          speakerName: seg.speaker_name,
          text: seg.text,
          startTime: seg.start_time,
        })
      );

    // Chunk transcript for embedding
    const chunks = chunkTranscriptForEmbedding(sortedSegments);

    if (chunks.length === 0) {
      return NextResponse.json({
        success: true,
        chunksProcessed: 0,
        message: "No content to embed",
      });
    }

    // Generate embeddings for all chunks
    const embeddings = await generateEmbeddings(chunks.map((c) => c.text));

    // Save embeddings to database
    const embeddingRecords = chunks.map((chunk, i) => ({
      user_id: user.id,
      session_id: id,
      content: chunk.text,
      embedding: embeddings[i].embedding,
      metadata: {
        speakerName: chunk.speakerName,
        startTime: chunk.startTime,
        segmentIndices: chunk.segmentIndices,
      },
    }));

    const { error: insertError } = await supabase
      .from("memory_embeddings")
      .insert(embeddingRecords);

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({
      success: true,
      chunksProcessed: chunks.length,
      totalTokens: embeddings.reduce((sum, e) => sum + e.tokens, 0),
    });
  } catch (error) {
    console.error("Generate embeddings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]/embeddings
 * Delete embeddings for a session
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify session ownership
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

    const { error } = await supabase
      .from("memory_embeddings")
      .delete()
      .eq("session_id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete embeddings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
