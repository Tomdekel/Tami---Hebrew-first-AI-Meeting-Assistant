import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * Escape special characters in LIKE/ILIKE patterns
 */
function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, (char) => `\\${char}`);
}

/**
 * GET /api/people - List all people for the current user
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  try {
    let query = supabase
      .from("people")
      .select("*")
      .eq("user_id", user.id)
      .order("display_name", { ascending: true });

    // Optional search filter (escape special characters to prevent SQL injection)
    if (search && search.trim()) {
      const sanitizedSearch = search.trim().slice(0, 100); // Limit length
      const escapedSearch = escapeLikePattern(sanitizedSearch);
      const normalizedSearch = escapedSearch.toLowerCase();
      query = query.or(
        `normalized_key.ilike.%${normalizedSearch}%,display_name.ilike.%${escapedSearch}%`
      );
    }

    const { data: people, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ people: people || [] });
  } catch (error) {
    console.error("Failed to fetch people:", error);
    return NextResponse.json(
      { error: "Failed to fetch people" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/people - Create a new person
 */
export async function POST(request: NextRequest) {
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
    const { displayName, aliases = [] } = body;

    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json(
        { error: "displayName is required" },
        { status: 400 }
      );
    }

    const normalizedKey = displayName.toLowerCase().trim();

    // Check for existing person with same normalized key
    const { data: existing } = await supabase
      .from("people")
      .select("id")
      .eq("user_id", user.id)
      .eq("normalized_key", normalizedKey)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "A person with this name already exists", existingId: existing.id },
        { status: 409 }
      );
    }

    // Validate and sanitize aliases
    const validAliases = Array.isArray(aliases)
      ? aliases
          .filter((a): a is string => typeof a === "string" && a.trim().length > 0)
          .map((a) => a.trim())
          .slice(0, 20) // Limit number of aliases
      : [];

    // Create the person
    const { data: person, error } = await supabase
      .from("people")
      .insert({
        user_id: user.id,
        display_name: displayName.trim().slice(0, 200), // Limit length
        normalized_key: normalizedKey.slice(0, 200),
        aliases: validAliases,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    console.error("Failed to create person:", error);
    return NextResponse.json(
      { error: "Failed to create person" },
      { status: 500 }
    );
  }
}
