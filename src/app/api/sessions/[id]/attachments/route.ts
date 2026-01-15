import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Dynamic imports for document processing - loaded only when needed
// This prevents module load errors from crashing the GET handler
async function getDocumentProcessor() {
  const mod = await import("@/lib/ai/document-processor");
  return {
    processDocumentWithEmbeddings: mod.processDocumentWithEmbeddings,
    isSupportedDocumentType: mod.isSupportedDocumentType,
  };
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * GET /api/sessions/[id]/attachments
 * Get all attachments for a session
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

    // Get attachments - wrapped in try-catch since table may not exist in production
    try {
      const { data: attachments, error } = await supabase
        .from("attachments")
        .select("*")
        .eq("session_id", id)
        .order("created_at", { ascending: false });

      if (error) {
        // Log error and return empty array - table likely doesn't exist yet
        console.warn("Attachments query error (returning empty):", error.code, error.message);
        return NextResponse.json({ attachments: [] });
      }

      return NextResponse.json({
        attachments: (attachments || []).map((att) => ({
          id: att.id,
          name: att.name,
          fileUrl: att.file_url,
          fileType: att.file_type,
          fileSize: att.file_size,
          createdAt: att.created_at,
        })),
      });
    } catch (queryError) {
      // Catch any unexpected errors and return empty array
      console.warn("Attachments fetch failed (returning empty):", queryError);
      return NextResponse.json({ attachments: [] });
    }
  } catch (error) {
    console.error("Get attachments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]/attachments
 * Upload a file attachment to a session
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

    // Parse form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "File type not allowed" },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds 100MB limit" },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split(".").pop();
    const filename = `${user.id}/${id}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("attachments")
      .upload(filename, file, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return NextResponse.json(
        { error: "Failed to upload file" },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("attachments").getPublicUrl(filename);

    // Create attachment record
    const { data: attachment, error: dbError } = await supabase
      .from("attachments")
      .insert({
        session_id: id,
        user_id: user.id,
        name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        storage_path: filename,
      })
      .select()
      .single();

    if (dbError) {
      // Try to clean up uploaded file
      await supabase.storage.from("attachments").remove([filename]);
      throw dbError;
    }

    // Process document and create embeddings if supported
    let embeddingsCreated = 0;
    try {
      const { isSupportedDocumentType, processDocumentWithEmbeddings } = await getDocumentProcessor();
      if (isSupportedDocumentType(file.type, file.name)) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const { embeddings, metadata } = await processDocumentWithEmbeddings(
          buffer,
          file.type,
          file.name
        );

        const chunkRows = embeddings.map((emb) => ({
          attachment_id: attachment.id,
          session_id: id,
          user_id: user.id,
          chunk_index: emb.chunkIndex,
          content: emb.content,
          page_number: emb.metadata.pageNumber ?? null,
          sheet_name: emb.metadata.sheetName ?? null,
        }));

        const { data: chunkRecords, error: chunkError } = await supabase
          .from("attachment_chunks")
          .upsert(chunkRows, { onConflict: "attachment_id,chunk_index" })
          .select("id, chunk_index");

        if (chunkError) {
          console.error("Failed to save attachment chunks:", chunkError);
        }

        const chunkIdByIndex = new Map<number, string>(
          (chunkRecords || []).map((row: { id: string; chunk_index: number }) => [row.chunk_index, row.id])
        );

        // Store embeddings in memory_embeddings table
        if (embeddings.length > 0) {
          const embeddingRows = embeddings.map((emb) => ({
            user_id: user.id,
            session_id: id,
            content: emb.content,
            embedding: `[${emb.embedding.join(",")}]`,
            metadata: {
              source_type: "attachment",
              attachment_id: attachment.id,
              attachment_name: file.name,
              chunk_index: emb.chunkIndex,
              chunk_id: chunkIdByIndex.get(emb.chunkIndex),
              page_number: emb.metadata.pageNumber ?? null,
              sheet_name: emb.metadata.sheetName ?? null,
              ...emb.metadata,
            },
          }));

          const { error: embError } = await supabase
            .from("memory_embeddings")
            .insert(embeddingRows);

          if (embError) {
            console.error("Failed to save embeddings:", embError);
          } else {
            embeddingsCreated = embeddings.length;
          }
        }

        console.log(
          `Processed ${file.name}: ${metadata.wordCount} words, ${embeddingsCreated} chunks embedded`
        );
      }
    } catch (procError) {
      // Log but don't fail the upload if document processing fails
      console.error("Document processing error:", procError);
    }

    return NextResponse.json({
      attachment: {
        id: attachment.id,
        name: attachment.name,
        fileUrl: attachment.file_url,
        fileType: attachment.file_type,
        fileSize: attachment.file_size,
        createdAt: attachment.created_at,
        embeddingsCreated,
      },
    });
  } catch (error) {
    console.error("Upload attachment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
