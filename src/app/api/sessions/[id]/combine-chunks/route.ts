import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const AUDIO_BUCKET = "audio";

/**
 * POST /api/sessions/[id]/combine-chunks
 *
 * Server-side chunk combination for long recordings.
 * This moves the memory-intensive operation from the browser to the server,
 * enabling support for recordings up to 120 minutes (240 chunks).
 *
 * The server processes chunks in batches to manage memory, then uploads
 * the combined file and cleans up individual chunks.
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

  // Verify the session belongs to the user
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let body: { chunkCount: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { chunkCount } = body;

  // Validate chunk count
  // Max 500 chunks = 250 minutes at 30s intervals (well above 120 min requirement)
  const MAX_CHUNKS = 500;
  if (!chunkCount || chunkCount <= 0) {
    return NextResponse.json({ error: "Invalid chunk count" }, { status: 400 });
  }
  if (chunkCount > MAX_CHUNKS) {
    return NextResponse.json(
      { error: `Chunk count exceeds maximum (${MAX_CHUNKS})` },
      { status: 400 }
    );
  }

  try {
    // Download all chunks and combine them
    // For server-side, we can handle more memory than the browser
    // but we still process them sequentially to avoid memory spikes
    const combinedChunks: Buffer[] = [];
    const failedChunks: number[] = [];

    console.log(`[combine-chunks] Starting combination of ${chunkCount} chunks for session ${sessionId}`);

    for (let i = 0; i < chunkCount; i++) {
      const chunkPath = `${user.id}/${sessionId}/chunks/chunk_${i.toString().padStart(4, "0")}.webm`;

      const { data, error } = await supabase.storage
        .from(AUDIO_BUCKET)
        .download(chunkPath);

      if (error || !data) {
        console.error(`[combine-chunks] Failed to download chunk ${i}:`, error?.message);
        failedChunks.push(i);
        continue;
      }

      const buffer = Buffer.from(await data.arrayBuffer());
      combinedChunks.push(buffer);

      // Log progress every 50 chunks
      if ((i + 1) % 50 === 0) {
        console.log(`[combine-chunks] Downloaded ${i + 1}/${chunkCount} chunks`);
      }
    }

    if (combinedChunks.length === 0) {
      return NextResponse.json(
        { error: "No chunks could be downloaded" },
        { status: 500 }
      );
    }

    if (failedChunks.length > 0) {
      console.warn(`[combine-chunks] ${failedChunks.length} chunks failed to download:`, failedChunks.slice(0, 10));
    }

    // Combine all buffers into one
    const finalBuffer = Buffer.concat(combinedChunks);
    const finalPath = `${user.id}/${sessionId}/recording.webm`;

    console.log(`[combine-chunks] Combined ${combinedChunks.length} chunks into ${(finalBuffer.length / (1024 * 1024)).toFixed(1)}MB`);

    // Upload the combined file
    const { error: uploadError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .upload(finalPath, finalBuffer, {
        contentType: "audio/webm",
        upsert: true,
      });

    if (uploadError) {
      console.error("[combine-chunks] Failed to upload combined file:", uploadError);
      return NextResponse.json(
        { error: "Failed to save combined recording. Please try again." },
        { status: 500 }
      );
    }

    // CRITICAL: Verify the file actually exists before returning URL
    // getPublicUrl() is synchronous and doesn't verify file existence
    const parts = finalPath.split('/');
    const fileName = parts.pop();
    const folder = parts.join('/');

    const { data: verifyFiles, error: verifyError } = await supabase.storage
      .from(AUDIO_BUCKET)
      .list(folder);

    if (verifyError || !verifyFiles) {
      console.error("[combine-chunks] Failed to verify uploaded file:", verifyError?.message);
      return NextResponse.json(
        { error: "Upload succeeded but file verification failed. Please try again." },
        { status: 500 }
      );
    }

    const fileExists = verifyFiles.some(f => f.name === fileName);
    if (!fileExists) {
      console.error("[combine-chunks] Uploaded file not found in storage after upload");
      return NextResponse.json(
        { error: "Upload succeeded but file not found in storage. Please try again." },
        { status: 500 }
      );
    }

    // Get public URL (now we know the file exists)
    const { data: urlData } = supabase.storage
      .from(AUDIO_BUCKET)
      .getPublicUrl(finalPath);

    console.log(`[combine-chunks] Uploaded and verified combined file: ${finalPath}`);

    // Clean up individual chunks
    const chunkPaths: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      chunkPaths.push(`${user.id}/${sessionId}/chunks/chunk_${i.toString().padStart(4, "0")}.webm`);
    }

    // Supabase storage remove has a limit, delete in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < chunkPaths.length; i += BATCH_SIZE) {
      const batch = chunkPaths.slice(i, i + BATCH_SIZE);
      const { error: deleteError } = await supabase.storage
        .from(AUDIO_BUCKET)
        .remove(batch);

      if (deleteError) {
        console.warn(`[combine-chunks] Failed to delete chunk batch ${i}-${i + batch.length}:`, deleteError.message);
        // Don't fail the request - cleanup failure is not critical
      }
    }

    console.log(`[combine-chunks] Cleaned up ${chunkPaths.length} chunks`);

    return NextResponse.json({
      url: urlData.publicUrl,
      path: finalPath,
      chunksProcessed: combinedChunks.length,
      chunksFailed: failedChunks.length,
    });
  } catch (error) {
    console.error("[combine-chunks] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
