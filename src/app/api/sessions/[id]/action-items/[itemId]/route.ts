import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

/**
 * PATCH /api/sessions/[id]/action-items/[itemId]
 * Update an action item
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id, itemId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership through session
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

    // Parse request body
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.description !== undefined) updates.description = body.description;
    if (body.assignee !== undefined) updates.assignee = body.assignee;
    if (body.deadline !== undefined) updates.deadline = body.deadline;
    if (body.completed !== undefined) updates.completed = body.completed;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Update action item
    const { data: actionItem, error: updateError } = await supabase
      .from("action_items")
      .update(updates)
      .eq("id", itemId)
      .select()
      .single();

    if (updateError) {
      if (updateError.code === "PGRST116") {
        return NextResponse.json({ error: "Action item not found" }, { status: 404 });
      }
      throw updateError;
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
    console.error("Update action item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]/action-items/[itemId]
 * Delete an action item
 */
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id, itemId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership through session
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

    // Delete action item
    const { error: deleteError } = await supabase
      .from("action_items")
      .delete()
      .eq("id", itemId);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete action item error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
