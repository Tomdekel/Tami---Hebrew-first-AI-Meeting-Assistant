import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const AUDIO_BUCKET = "audio";

/**
 * GET /api/admin/sessions/[id]/diagnose
 *
 * Diagnostic endpoint to check the state of a session's audio files.
 * Useful for debugging upload failures and understanding storage state.
 *
 * Returns:
 * - Session metadata
 * - Whether chunks exist in storage
 * - Whether combined file exists
 * - Storage file list
 * - Recommendations for recovery
 */
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

  // Get session from database
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // List files in the session's storage folder
  const sessionFolder = `${user.id}/${sessionId}`;
  const { data: files, error: listError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .list(sessionFolder);

  // List chunks in the chunks subfolder
  const chunksFolder = `${sessionFolder}/chunks`;
  const { data: chunks, error: chunksError } = await supabase.storage
    .from(AUDIO_BUCKET)
    .list(chunksFolder);

  // Check if combined file exists
  const combinedFileExists = files?.some(f => f.name === "recording.webm") ?? false;

  // Count chunks
  const chunkCount = chunks?.filter(f => f.name.startsWith("chunk_") && f.name.endsWith(".webm")).length ?? 0;

  // Check if audio_url is accessible
  let audioUrlAccessible = false;
  if (session.audio_url) {
    try {
      const response = await fetch(session.audio_url, { method: "HEAD" });
      audioUrlAccessible = response.ok;
    } catch {
      audioUrlAccessible = false;
    }
  }

  // Generate diagnosis
  const diagnosis: string[] = [];
  const recommendations: string[] = [];

  if (session.status === "failed") {
    diagnosis.push("Session marked as failed");
  }

  if (!session.audio_url) {
    diagnosis.push("No audio_url set in session");
    if (combinedFileExists) {
      recommendations.push("Combined file exists in storage - can recover by setting audio_url");
    } else if (chunkCount > 0) {
      recommendations.push(`${chunkCount} chunks exist in storage - can recover by combining chunks`);
    } else {
      diagnosis.push("No audio data in storage - recording may not have been uploaded");
    }
  } else if (!audioUrlAccessible) {
    diagnosis.push("audio_url is set but file is not accessible");
    if (combinedFileExists) {
      recommendations.push("Combined file exists - may need to regenerate URL");
    } else if (chunkCount > 0) {
      recommendations.push(`${chunkCount} chunks exist - can recover by combining chunks`);
    }
  } else {
    diagnosis.push("audio_url is accessible");
  }

  if (session.processing_state === "draft" && !session.transcript_id) {
    diagnosis.push("No transcript - transcription never started or failed");
    if (audioUrlAccessible || combinedFileExists || chunkCount > 0) {
      recommendations.push("Can trigger transcription after ensuring audio_url is set");
    }
  }

  const canRecover = combinedFileExists || chunkCount > 0;

  return NextResponse.json({
    session: {
      id: session.id,
      title: session.title,
      status: session.status,
      processing_state: session.processing_state,
      audio_url: session.audio_url,
      transcript_id: session.transcript_id,
      created_at: session.created_at,
      updated_at: session.updated_at,
    },
    storage: {
      folder: sessionFolder,
      files: files?.map(f => ({ name: f.name, size: f.metadata?.size })) ?? [],
      listError: listError?.message ?? null,
      combinedFileExists,
      chunks: {
        folder: chunksFolder,
        count: chunkCount,
        files: chunks?.slice(0, 10).map(f => f.name) ?? [], // First 10 for brevity
        listError: chunksError?.message ?? null,
      },
    },
    audioUrlAccessible,
    diagnosis,
    recommendations,
    canRecover,
  });
}
