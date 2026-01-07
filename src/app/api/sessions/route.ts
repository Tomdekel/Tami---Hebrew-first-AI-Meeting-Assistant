import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import type { Session } from "@/lib/types/database";

// GET /api/sessions - List user's sessions
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");
  const status = searchParams.get("status");

  let query = supabase
    .from("sessions")
    .select("*", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    sessions: data as Session[],
    total: count,
    limit,
    offset,
  });
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { title, context, audio_url, detected_language, duration_seconds } = body;

  const { data, error } = await supabase
    .from("sessions")
    .insert({
      user_id: user.id,
      title: title || null,
      context: context || null,
      status: audio_url ? "pending" : "recording",
      audio_url: audio_url || null,
      detected_language: detected_language || null,
      duration_seconds: duration_seconds || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ session: data as Session }, { status: 201 });
}
