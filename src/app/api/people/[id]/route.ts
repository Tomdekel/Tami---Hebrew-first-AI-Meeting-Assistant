import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/people/[id] - Get a specific person
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data: person, error } = await supabase
      .from("people")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !person) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // Also get sessions where this person appears
    const { data: sessionPeople } = await supabase
      .from("session_people")
      .select(`
        session_id,
        confidence,
        sessions:session_id (
          id,
          title,
          created_at
        )
      `)
      .eq("person_id", id);

    return NextResponse.json({
      person,
      sessions: sessionPeople?.map((sp) => sp.sessions) || [],
    });
  } catch (error) {
    console.error("Failed to fetch person:", error);
    return NextResponse.json(
      { error: "Failed to fetch person" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/people/[id] - Update a person
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { displayName, aliases } = body;

    // Verify ownership
    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (displayName && typeof displayName === "string") {
      updates.display_name = displayName.trim();
      updates.normalized_key = displayName.toLowerCase().trim();
    }

    if (Array.isArray(aliases)) {
      updates.aliases = aliases.map((a: string) => a.trim());
    }

    const { data: person, error } = await supabase
      .from("people")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ person });
  } catch (error) {
    console.error("Failed to update person:", error);
    return NextResponse.json(
      { error: "Failed to update person" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/people/[id] - Delete a person
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Verify ownership
    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Person not found" }, { status: 404 });
    }

    // Delete will cascade to session_speakers.person_id (SET NULL)
    // and session_people (CASCADE)
    const { error } = await supabase.from("people").delete().eq("id", id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete person:", error);
    return NextResponse.json(
      { error: "Failed to delete person" },
      { status: 500 }
    );
  }
}
