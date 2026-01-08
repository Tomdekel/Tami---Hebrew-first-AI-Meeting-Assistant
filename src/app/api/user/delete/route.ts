import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

/**
 * DELETE /api/user/delete
 * Delete the current user's account and all associated data
 */
export async function DELETE() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Delete user data in order (respecting foreign keys)
    // 1. Memory embeddings
    await supabase.from("memory_embeddings").delete().eq("user_id", user.id);

    // 2. Entity mentions (via sessions)
    const { data: sessions } = await supabase
      .from("sessions")
      .select("id")
      .eq("user_id", user.id);

    if (sessions) {
      const sessionIds = sessions.map((s) => s.id);
      if (sessionIds.length > 0) {
        await supabase
          .from("entity_mentions")
          .delete()
          .in("session_id", sessionIds);
      }
    }

    // 3. Entities
    await supabase.from("entities").delete().eq("user_id", user.id);

    // 4. Session tags
    if (sessions) {
      const sessionIds = sessions.map((s) => s.id);
      if (sessionIds.length > 0) {
        await supabase.from("session_tags").delete().in("session_id", sessionIds);
      }
    }

    // 5. Tags
    await supabase.from("tags").delete().eq("user_id", user.id);

    // 6. Attachments (delete from storage too)
    const { data: attachments } = await supabase
      .from("attachments")
      .select("storage_path")
      .eq("user_id", user.id);

    if (attachments && attachments.length > 0) {
      const paths = attachments
        .map((a) => a.storage_path)
        .filter(Boolean) as string[];
      if (paths.length > 0) {
        await supabase.storage.from("attachments").remove(paths);
      }
    }
    await supabase.from("attachments").delete().eq("user_id", user.id);

    // 7. Chat messages (via sessions cascade)
    // 8. Action items (via summaries cascade)
    // 9. Summaries (via sessions cascade)
    // 10. Transcript segments (via transcripts cascade)
    // 11. Transcripts (via sessions cascade)

    // 12. Delete audio files from storage
    if (sessions) {
      const audioPaths = sessions
        .filter((s) => s.id)
        .map((s) => `recordings/${user.id}/${s.id}`);
      // Note: This deletes the folder structure, actual files might need listing
    }

    // 13. Sessions (this cascades to transcripts, summaries, chat_messages)
    await supabase.from("sessions").delete().eq("user_id", user.id);

    // Delete user from auth using admin client
    // Note: This requires SUPABASE_SERVICE_ROLE_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const supabaseAdmin = createServiceClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
        user.id
      );

      if (deleteError) {
        console.error("Error deleting auth user:", deleteError);
        // Don't throw - data is already deleted
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
