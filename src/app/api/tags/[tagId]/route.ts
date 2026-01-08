import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ tagId: string }>;
}

/**
 * PATCH /api/tags/[tagId]
 * Update a tag
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { tagId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const { data: existingTag } = await supabase
      .from("tags")
      .select("id, user_id")
      .eq("id", tagId)
      .single();

    if (!existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (existingTag.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name.trim();
    if (body.color !== undefined) updates.color = body.color;
    if (body.isVisible !== undefined) updates.is_visible = body.isVisible;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Check for duplicate name if updating name
    if (updates.name) {
      const { data: duplicate } = await supabase
        .from("tags")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", updates.name)
        .neq("id", tagId)
        .single();

      if (duplicate) {
        return NextResponse.json(
          { error: "Tag with this name already exists" },
          { status: 409 }
        );
      }
    }

    const { data: tag, error } = await supabase
      .from("tags")
      .update(updates)
      .eq("id", tagId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      tag: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        source: tag.source,
        isVisible: tag.is_visible,
        createdAt: tag.created_at,
      },
    });
  } catch (error) {
    console.error("Update tag error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tags/[tagId]
 * Delete a tag
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { tagId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const { data: existingTag } = await supabase
      .from("tags")
      .select("id, user_id")
      .eq("id", tagId)
      .single();

    if (!existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    if (existingTag.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Delete tag (cascade will remove session_tags)
    const { error } = await supabase.from("tags").delete().eq("id", tagId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete tag error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
