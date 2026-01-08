import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/sessions/[id]/adjacent
 * Get the previous and next meetings by date
 */
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Check auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get current session's created_at
    const { data: currentSession, error: currentError } = await supabase
      .from("sessions")
      .select("id, created_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (currentError || !currentSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get previous session (older than current)
    const { data: previousSession } = await supabase
      .from("sessions")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .lt("created_at", currentSession.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // Get next session (newer than current)
    const { data: nextSession } = await supabase
      .from("sessions")
      .select("id, title, created_at")
      .eq("user_id", user.id)
      .gt("created_at", currentSession.created_at)
      .order("created_at", { ascending: true })
      .limit(1)
      .single();

    return NextResponse.json({
      previous: previousSession || null,
      next: nextSession || null,
    });
  } catch (error) {
    console.error("Adjacent sessions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
