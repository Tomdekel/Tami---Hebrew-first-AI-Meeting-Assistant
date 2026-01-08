import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { unauthorized, internalError } from "@/lib/api/errors";
import { validateBody, createSessionSchema } from "@/lib/validations";
import type { Session } from "@/lib/types/database";

// GET /api/sessions - List user's sessions
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized();
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const status = searchParams.get("status");
    const tagId = searchParams.get("tagId");
    const search = searchParams.get("search");

    // If filtering by tag, we need to join with session_tags
    if (tagId) {
      // Get session IDs that have this tag
      const { data: sessionTags, error: tagError } = await supabase
        .from("session_tags")
        .select("session_id")
        .eq("tag_id", tagId);

      if (tagError) {
        return internalError("Failed to fetch tagged sessions", { dbError: tagError.message });
      }

      const sessionIds = sessionTags?.map((st) => st.session_id) || [];

      if (sessionIds.length === 0) {
        return NextResponse.json({
          sessions: [],
          total: 0,
          limit,
          offset,
        });
      }

      let query = supabase
        .from("sessions")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .in("id", sessionIds)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq("status", status);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,context.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        return internalError("Failed to fetch sessions", { dbError: error.message });
      }

      return NextResponse.json({
        sessions: data as Session[],
        total: count,
        limit,
        offset,
      });
    }

    // Normal query without tag filter
    let query = supabase
      .from("sessions")
      .select("*", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,context.ilike.%${search}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      return internalError("Failed to fetch sessions", { dbError: error.message });
    }

    return NextResponse.json({
      sessions: data as Session[],
      total: count,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /api/sessions error:", error);
    return internalError();
  }
}

// POST /api/sessions - Create a new session
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return unauthorized();
    }

    const { data: body, error: validationError } = await validateBody(
      request,
      createSessionSchema
    );

    if (validationError) {
      return validationError;
    }

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
      return internalError("Failed to create session", { dbError: error.message });
    }

    return NextResponse.json({ session: data as Session }, { status: 201 });
  } catch (error) {
    console.error("POST /api/sessions error:", error);
    return internalError();
  }
}
