import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/tags
 * Get all tags for the current user
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: tags, error } = await supabase
      .from("tags")
      .select(`
        id,
        name,
        color,
        source,
        is_visible,
        created_at,
        session_tags (count)
      `)
      .eq("user_id", user.id)
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      tags: (tags || []).map((tag) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color,
        source: tag.source,
        isVisible: tag.is_visible,
        createdAt: tag.created_at,
        sessionCount: (tag.session_tags as { count: number }[])?.[0]?.count || 0,
      })),
    });
  } catch (error) {
    console.error("Get tags error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tags
 * Create a new tag
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, color } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    // Check for duplicate
    const { data: existing } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", user.id)
      .eq("name", name.trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Tag with this name already exists" },
        { status: 409 }
      );
    }

    const { data: tag, error } = await supabase
      .from("tags")
      .insert({
        user_id: user.id,
        name: name.trim(),
        color: color || "#3B82F6",
        source: "manual",
        is_visible: true,
      })
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
    console.error("Create tag error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
