import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string; attachmentId: string }>;
}

/**
 * GET /api/sessions/[id]/attachments/[attachmentId]
 * Get a specific attachment
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id, attachmentId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get attachment and verify ownership
    const { data: attachment, error } = await supabase
      .from("attachments")
      .select("*, sessions!inner(user_id)")
      .eq("id", attachmentId)
      .eq("session_id", id)
      .single();

    if (error || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const session = attachment.sessions as { user_id: string };
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    return NextResponse.json({
      attachment: {
        id: attachment.id,
        name: attachment.name,
        fileUrl: attachment.file_url,
        fileType: attachment.file_type,
        fileSize: attachment.file_size,
        createdAt: attachment.created_at,
      },
    });
  } catch (error) {
    console.error("Get attachment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]/attachments/[attachmentId]
 * Delete an attachment
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id, attachmentId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get attachment and verify ownership
    const { data: attachment, error: fetchError } = await supabase
      .from("attachments")
      .select("*, sessions!inner(user_id)")
      .eq("id", attachmentId)
      .eq("session_id", id)
      .single();

    if (fetchError || !attachment) {
      return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
    }

    const session = attachment.sessions as { user_id: string };
    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete from storage
    if (attachment.storage_path) {
      const { error: storageError } = await supabase.storage
        .from("attachments")
        .remove([attachment.storage_path]);

      if (storageError) {
        console.error("Storage delete error:", storageError);
        // Continue with database delete even if storage delete fails
      }
    }

    // Delete from database
    const { error: deleteError } = await supabase
      .from("attachments")
      .delete()
      .eq("id", attachmentId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete attachment error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
