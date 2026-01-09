/**
 * Relationship Suggestions API
 *
 * GET /api/graph/suggestions - List pending relationship suggestions
 * POST /api/graph/suggestions - Create a suggestion (for testing)
 * PATCH /api/graph/suggestions - Approve or reject suggestions
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { runSingleQuery } from "@/lib/neo4j/client";
import { isValidRelationshipType } from "@/lib/ai/relationships";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "pending";
  const sessionId = searchParams.get("sessionId");

  let query = supabase
    .from("relationship_suggestions")
    .select(`
      *,
      sessions (title)
    `)
    .eq("user_id", user.id)
    .eq("status", status)
    .order("confidence", { ascending: false });

  if (sessionId) {
    query = query.eq("session_id", sessionId);
  }

  const { data: suggestions, error } = await query;

  if (error) {
    console.error("Failed to fetch suggestions:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    suggestions: suggestions || [],
    count: suggestions?.length || 0,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    sessionId,
    sourceValue,
    targetValue,
    sourceType,
    targetType,
    relationshipType,
    confidence = 0.5,
    context,
  } = body;

  if (!sessionId || !sourceValue || !targetValue || !relationshipType) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  // Validate relationship type
  if (!isValidRelationshipType(relationshipType)) {
    return NextResponse.json(
      { error: "Invalid relationship type" },
      { status: 400 }
    );
  }

  // Verify session belongs to user
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Look up entity IDs if they exist
  const { data: sourceEntity } = await supabase
    .from("entities")
    .select("id")
    .eq("user_id", user.id)
    .ilike("normalized_value", sourceValue.toLowerCase())
    .single();

  const { data: targetEntity } = await supabase
    .from("entities")
    .select("id")
    .eq("user_id", user.id)
    .ilike("normalized_value", targetValue.toLowerCase())
    .single();

  const { data: suggestion, error } = await supabase
    .from("relationship_suggestions")
    .insert({
      user_id: user.id,
      session_id: sessionId,
      source_entity_id: sourceEntity?.id || null,
      target_entity_id: targetEntity?.id || null,
      source_value: sourceValue,
      target_value: targetValue,
      source_type: sourceType || "other",
      target_type: targetType || "other",
      relationship_type: relationshipType,
      confidence,
      context,
      status: "pending",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create suggestion:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ suggestion });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { suggestionId, action } = body;

  if (!suggestionId || !action) {
    return NextResponse.json(
      { error: "Missing suggestionId or action" },
      { status: 400 }
    );
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json(
      { error: "Action must be 'approve' or 'reject'" },
      { status: 400 }
    );
  }

  // Get the suggestion
  const { data: suggestion, error: fetchError } = await supabase
    .from("relationship_suggestions")
    .select("*")
    .eq("id", suggestionId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !suggestion) {
    return NextResponse.json({ error: "Suggestion not found" }, { status: 404 });
  }

  if (suggestion.status !== "pending") {
    return NextResponse.json(
      { error: "Suggestion already reviewed" },
      { status: 400 }
    );
  }

  // Update the suggestion status
  const { error: updateError } = await supabase
    .from("relationship_suggestions")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  if (updateError) {
    console.error("Failed to update suggestion:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // If approved, create the relationship in Neo4j
  if (action === "approve") {
    // Validate relationship type
    if (!isValidRelationshipType(suggestion.relationship_type)) {
      console.error("Invalid relationship type:", suggestion.relationship_type);
      return NextResponse.json(
        { error: "Invalid relationship type" },
        { status: 400 }
      );
    }

    try {
      await runSingleQuery(
        `
        MATCH (source:Entity {user_id: $userId})
        WHERE toLower(source.normalized_value) = toLower($sourceNormalized)
           OR toLower(source.display_value) = toLower($sourceValue)
        MATCH (target:Entity {user_id: $userId})
        WHERE toLower(target.normalized_value) = toLower($targetNormalized)
           OR toLower(target.display_value) = toLower($targetValue)
        MERGE (source)-[r:${suggestion.relationship_type}]->(target)
        ON CREATE SET
          r.confidence = $confidence,
          r.context = $context,
          r.source = 'user_approved',
          r.session_id = $sessionId,
          r.created_at = datetime()
        RETURN source.id as sourceId, target.id as targetId
        `,
        {
          userId: user.id,
          sourceNormalized: suggestion.source_value.toLowerCase(),
          sourceValue: suggestion.source_value,
          targetNormalized: suggestion.target_value.toLowerCase(),
          targetValue: suggestion.target_value,
          confidence: suggestion.confidence,
          context: suggestion.context || "",
          sessionId: suggestion.session_id,
        }
      );
    } catch (neo4jError) {
      console.error("Failed to create relationship in Neo4j:", neo4jError);
      // Don't fail the request - suggestion is marked approved
    }
  }

  return NextResponse.json({
    success: true,
    action,
    suggestionId,
  });
}
