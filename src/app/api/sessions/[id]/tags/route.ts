import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id]/tags
 * Get tags for a session
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

    // Get session tags
    const { data: sessionTags, error } = await supabase
      .from("session_tags")
      .select(`
        tags (
          id,
          name,
          color,
          source,
          is_visible
        )
      `)
      .eq("session_id", id);

    if (error) {
      throw error;
    }

    const tags = (sessionTags || []).map((st) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tagsData = st.tags as any;
      const tag = Array.isArray(tagsData) ? tagsData[0] : tagsData;
      return {
        id: tag?.id || "",
        name: tag?.name || "",
        color: tag?.color || "",
        source: tag?.source || "",
        isVisible: tag?.is_visible ?? true,
      };
    });

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Get session tags error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]/tags
 * Add a tag to a session
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

    const { tagId } = await request.json();

    if (!tagId) {
      return NextResponse.json({ error: "tagId is required" }, { status: 400 });
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

    // Verify tag ownership
    const { data: tag } = await supabase
      .from("tags")
      .select("id, user_id")
      .eq("id", tagId)
      .single();

    if (!tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (tag.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Add tag to session (upsert to avoid duplicates)
    const { error } = await supabase.from("session_tags").upsert({
      session_id: id,
      tag_id: tagId,
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Add session tag error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]/tags
 * Remove a tag from a session
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

    const { searchParams } = new URL(request.url);
    const tagId = searchParams.get("tagId");

    if (!tagId) {
      return NextResponse.json({ error: "tagId is required" }, { status: 400 });
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

    // Remove tag from session
    const { error } = await supabase
      .from("session_tags")
      .delete()
      .eq("session_id", id)
      .eq("tag_id", tagId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Remove session tag error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
