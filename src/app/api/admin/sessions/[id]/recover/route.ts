import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const AUDIO_BUCKET = "audio";

/**
 * POST /api/admin/sessions/[id]/recover
 *
 * Recovery endpoint to fix sessions with broken audio uploads.
 *
 * Actions:
 * 1. Check for existing combined file or chunks
 * 2. If chunks exist but no combined file, trigger combination
 * 3. Update session with correct audio_url
 * 4. Optionally trigger transcription
 *
 * Request body:
 * - triggerTranscription?: boolean - Whether to start transcription after recovery
 */
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

  let body: { triggerTranscription?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const { triggerTranscription = false } = body;

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

  const sessionFolder = `${user.id}/${sessionId}`;
  const chunksFolder = `${sessionFolder}/chunks`;
  const combinedPath = `${sessionFolder}/recording.webm`;

  // Check if combined file already exists
  const { data: files } = await supabase.storage
    .from(AUDIO_BUCKET)
    .list(sessionFolder);

  const combinedExists = files?.some(f => f.name === "recording.webm") ?? false;

  // Check for chunks
  const { data: chunks } = await supabase.storage
    .from(AUDIO_BUCKET)
    .list(chunksFolder);

  const chunkFiles = chunks?.filter(f => f.name.startsWith("chunk_") && f.name.endsWith(".webm")) ?? [];
  const chunkCount = chunkFiles.length;

  const recoveryLog: string[] = [];
  let audioUrl: string | null = null;

  if (combinedExists) {
    // Combined file exists, just get the URL
    recoveryLog.push("Found existing combined recording file");
    const { data: urlData } = supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(combinedPath);
    audioUrl = urlData.publicUrl;
  } else if (chunkCount > 0) {
    // Need to combine chunks
    recoveryLog.push(`Found ${chunkCount} chunks, combining...`);

    // Download all chunks
    const combinedChunks: Buffer[] = [];
    const failedChunks: number[] = [];

    for (let i = 0; i < chunkCount; i++) {
      const chunkPath = `${chunksFolder}/chunk_${i.toString().padStart(4, "0")}.webm`;
      const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .download(chunkPath);

      if (error || !data) {
        failedChunks.push(i);
        continue;
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      combinedChunks.push(buffer);
    }

    if (combinedChunks.length === 0) {
      return NextResponse.json(
        { error: "No chunks could be downloaded", recoveryLog },
        { status: 500 }
      );
    }

    recoveryLog.push(`Downloaded ${combinedChunks.length}/${chunkCount} chunks`);
    if (failedChunks.length > 0) {
      recoveryLog.push(`Failed chunks: ${failedChunks.join(", ")}`);
    }

    // Combine and upload
    const finalBuffer = Buffer.concat(combinedChunks);
    recoveryLog.push(`Combined size: ${(finalBuffer.length / (1024 * 1024)).toFixed(2)}MB`);

    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(combinedPath, finalBuffer, {
        contentType: "audio/webm",
        upsert: true,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `Failed to upload combined file: ${uploadError.message}`, recoveryLog },
        { status: 500 }
      );
    }

    recoveryLog.push("Uploaded combined recording");

    // Verify upload
    const { data: verifyFiles } = await supabase.storage
      .from(AUDIO_BUCKET)
      .list(sessionFolder);

    if (!verifyFiles?.some(f => f.name === "recording.webm")) {
      return NextResponse.json(
        { error: "Upload verification failed", recoveryLog },
        { status: 500 }
      );
    }

    recoveryLog.push("Verified upload");

    const { data: urlData } = supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(combinedPath);
    audioUrl = urlData.publicUrl;

    // Clean up chunks
    const chunkPaths = chunkFiles.map(f => `${chunksFolder}/${f.name}`);
    const BATCH_SIZE = 100;
    for (let i = 0; i < chunkPaths.length; i += BATCH_SIZE) {
      const batch = chunkPaths.slice(i, i + BATCH_SIZE);
      await supabase.storage.from(AUDIO_BUCKET).remove(batch);
    }
    recoveryLog.push(`Cleaned up ${chunkPaths.length} chunks`);
  } else {
    return NextResponse.json(
      { error: "No audio data found (no combined file or chunks)", recoveryLog },
      { status: 400 }
    );
  }

  // Validate URL is accessible
  try {
    const response = await fetch(audioUrl, { method: "HEAD" });
    if (!response.ok) {
      return NextResponse.json(
        { error: `Audio URL not accessible (status ${response.status})`, audioUrl, recoveryLog },
        { status: 500 }
      );
    }
    recoveryLog.push("Audio URL validated");
  } catch (e) {
    return NextResponse.json(
      { error: `Audio URL validation failed: ${e instanceof Error ? e.message : "Unknown"}`, audioUrl, recoveryLog },
      { status: 500 }
    );
  }

  // Update session with audio_url
  const { error: updateError } = await supabase
    .from("sessions")
    .update({
      audio_url: audioUrl,
      status: "pending",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (updateError) {
    return NextResponse.json(
      { error: `Failed to update session: ${updateError.message}`, audioUrl, recoveryLog },
      { status: 500 }
    );
  }

  recoveryLog.push("Updated session with audio_url");

  // Optionally trigger transcription
  if (triggerTranscription) {
    try {
      // Use internal API to trigger transcription
      const transcriptionResponse = await fetch(
        `${request.nextUrl.origin}/api/sessions/${sessionId}/transcribe`,
        {
          method: "POST",
          headers: {
            Cookie: request.headers.get("Cookie") || "",
          },
        }
      );

      if (transcriptionResponse.ok) {
        recoveryLog.push("Triggered transcription");
      } else {
        const errorData = await transcriptionResponse.json().catch(() => ({}));
        recoveryLog.push(`Transcription trigger failed: ${errorData.error || transcriptionResponse.status}`);
      }
    } catch (e) {
      recoveryLog.push(`Transcription trigger error: ${e instanceof Error ? e.message : "Unknown"}`);
    }
  }

  return NextResponse.json({
    success: true,
    sessionId,
    audioUrl,
    recoveryLog,
    nextSteps: triggerTranscription
      ? ["Transcription triggered - check session status"]
      : ["Session updated - you can now trigger transcription manually"],
  });
}
