import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id]/action-items
 * Get all action items for a session
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

    // Get session to verify ownership
    const { data: session } = await supabase
      .from("sessions")
      .select("id, user_id, summaries(id)")
      .eq("id", id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const summaryId = session.summaries?.[0]?.id;
    if (!summaryId) {
      return NextResponse.json({ actionItems: [] });
    }

    // Get action items
    const { data: actionItems, error } = await supabase
      .from("action_items")
      .select("*")
      .eq("summary_id", summaryId)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      actionItems: actionItems.map((item) => ({
        id: item.id,
        description: item.description,
        assignee: item.assignee,
        deadline: item.deadline,
        completed: item.completed,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      })),
    });
  } catch (error) {
    console.error("Get action items error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions/[id]/action-items
 * Add a new action item
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

    // Parse request body
    const { description, assignee, deadline } = await request.json();

    if (!description) {
      return NextResponse.json(
        { error: "description is required" },
        { status: 400 }
      );
    }

    // Get session and summary
    const { data: session } = await supabase
      .from("sessions")
      .select("id, user_id, summaries(id)")
      .eq("id", id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    let summaryId = session.summaries?.[0]?.id;

    // Create summary if it doesn't exist
    if (!summaryId) {
      const { data: newSummary, error: summaryError } = await supabase
        .from("summaries")
        .insert({
          session_id: id,
          overview: "",
          key_points: [],
          decisions: [],
        })
        .select("id")
        .single();

      if (summaryError) {
        throw summaryError;
      }
      summaryId = newSummary.id;
    }

    // Create action item
    const { data: actionItem, error: createError } = await supabase
      .from("action_items")
      .insert({
        summary_id: summaryId,
        description,
        assignee: assignee || null,
        deadline: deadline || null,
        completed: false,
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return NextResponse.json({
      actionItem: {
        id: actionItem.id,
        description: actionItem.description,
        assignee: actionItem.assignee,
        deadline: actionItem.deadline,
        completed: actionItem.completed,
        createdAt: actionItem.created_at,
        updatedAt: actionItem.updated_at,
      },
    });
  } catch (error) {
    console.error("Create action item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
