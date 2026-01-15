import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface Decision {
  id: string;
  description: string;
  context: string | null;
}

// GET /api/sessions/[id]/decisions - List all decisions
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get session to verify ownership
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get summary with decisions
  const { data: summary } = await supabase
    .from("summaries")
    .select("id, decisions")
    .eq("session_id", sessionId)
    .single();

  const decisions = (summary?.decisions as Decision[]) || [];

  return NextResponse.json({ decisions });
}

// POST /api/sessions/[id]/decisions - Add a decision
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { description, context } = body;

  if (!description || typeof description !== "string") {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 }
    );
  }

  // Verify session ownership
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get or create summary
  let { data: summary } = await supabase
    .from("summaries")
    .select("id, decisions")
    .eq("session_id", sessionId)
    .single();

  if (!summary) {
    const { data: newSummary, error: createError } = await supabase
      .from("summaries")
      .insert({ session_id: sessionId, overview: null, key_points: [] })
      .select("id, decisions")
      .single();

    if (createError) {
      return NextResponse.json(
        { error: "Failed to create summary" },
        { status: 500 }
      );
    }
    summary = newSummary;
  }

  // Add new decision
  const decisions = (summary.decisions as Decision[]) || [];
  const newDecision: Decision = {
    id: crypto.randomUUID(),
    description,
    context: context || null,
  };
  decisions.push(newDecision);

  const { error: updateError } = await supabase
    .from("summaries")
    .update({ decisions, edited_at: new Date().toISOString() })
    .eq("id", summary.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to add decision" },
      { status: 500 }
    );
  }

  return NextResponse.json({ decision: newDecision }, { status: 201 });
}

// PATCH /api/sessions/[id]/decisions - Update a decision (by id in body)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { decisionId, description, context } = body;

  if (!decisionId) {
    return NextResponse.json(
      { error: "decisionId is required" },
      { status: 400 }
    );
  }

  // Verify session ownership
  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .single();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get summary
  const { data: summary } = await supabase
    .from("summaries")
    .select("id, decisions")
    .eq("session_id", sessionId)
    .single();

  if (!summary) {
    return NextResponse.json({ error: "Summary not found" }, { status: 404 });
  }

  const decisions = (summary.decisions as Decision[]) || [];
  const index = decisions.findIndex((d) => d.id === decisionId);

  if (index === -1) {
    return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  }

  // Update decision
  if (description !== undefined) decisions[index].description = description;
  if (context !== undefined) decisions[index].context = context;

  const { error: updateError } = await supabase
    .from("summaries")
    .update({ decisions, edited_at: new Date().toISOString() })
    .eq("id", summary.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to update decision" },
      { status: 500 }
    );
  }

  return NextResponse.json({ decision: decisions[index] });
}

// DELETE /api/sessions/[id]/decisions?decisionId=... - Delete a decision
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const decisionId = searchParams.get("decisionId");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!decisionId) {
    return NextResponse.json(
      { error: "decisionId query param required" },
      { status: 400 }
    );
  }

  // Verify session ownership
  const { data: session } = await supabase
    .from("sessions")
    .select("id, user_id")
    .eq("id", sessionId)
    .single();

  if (!session || session.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get summary
  const { data: summary } = await supabase
    .from("summaries")
    .select("id, decisions")
    .eq("session_id", sessionId)
    .single();

  if (!summary) {
    return NextResponse.json({ error: "Summary not found" }, { status: 404 });
  }

  const decisions = (summary.decisions as Decision[]) || [];
  const filtered = decisions.filter((d) => d.id !== decisionId);

  if (filtered.length === decisions.length) {
    return NextResponse.json({ error: "Decision not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("summaries")
    .update({ decisions: filtered, edited_at: new Date().toISOString() })
    .eq("id", summary.id);

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to delete decision" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
