import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/sessions/[id]/speakers/assign
 *
 * Assign a session speaker to a canonical Person.
 * This is the core write path for person-based retrieval.
 *
 * Flow:
 * 1. Resolve or create Person
 * 2. Upsert session_speakers with person_id
 * 3. Upsert session_people (the filter index)
 * 4. Update memory_embeddings metadata with person_id
 * 5. Log audit event
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
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
    const { speakerId, personName, personId: existingPersonId } = body;

    if (!speakerId || typeof speakerId !== "string") {
      return NextResponse.json(
        { error: "speakerId is required" },
        { status: 400 }
      );
    }

    if (!personName && !existingPersonId) {
      return NextResponse.json(
        { error: "Either personName or personId is required" },
        { status: 400 }
      );
    }

    // Verify session ownership
    const { data: session } = await supabase
      .from("sessions")
      .select("id, user_id")
      .eq("id", sessionId)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get old person_id for audit log
    const { data: existingSpeaker } = await supabase
      .from("session_speakers")
      .select("person_id")
      .eq("session_id", sessionId)
      .eq("speaker_id", speakerId)
      .single();

    const oldPersonId = existingSpeaker?.person_id || null;

    // Step 1: Resolve or create Person
    let personId: string;

    if (existingPersonId) {
      // Use existing person - verify ownership
      const { data: existingPerson } = await supabase
        .from("people")
        .select("id")
        .eq("id", existingPersonId)
        .eq("user_id", user.id)
        .single();

      if (!existingPerson) {
        return NextResponse.json(
          { error: "Person not found" },
          { status: 404 }
        );
      }
      personId = existingPersonId;
    } else {
      // Create or find person by name
      const normalizedKey = personName.toLowerCase().trim();

      // Check if person already exists
      const { data: existingPerson } = await supabase
        .from("people")
        .select("id")
        .eq("user_id", user.id)
        .eq("normalized_key", normalizedKey)
        .single();

      if (existingPerson) {
        personId = existingPerson.id;
      } else {
        // Create new person
        const { data: newPerson, error: createError } = await supabase
          .from("people")
          .insert({
            user_id: user.id,
            display_name: personName.trim(),
            normalized_key: normalizedKey,
            aliases: [],
          })
          .select("id")
          .single();

        if (createError || !newPerson) {
          throw new Error("Failed to create person");
        }
        personId = newPerson.id;
      }
    }

    // Step 2: Upsert session_speakers
    const { error: speakerError } = await supabase
      .from("session_speakers")
      .upsert(
        {
          session_id: sessionId,
          speaker_id: speakerId,
          label: personName?.trim() || speakerId,
          person_id: personId,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "session_id,speaker_id",
        }
      );

    if (speakerError) {
      console.error("Failed to upsert session_speakers:", speakerError);
      throw speakerError;
    }

    // Step 3: Upsert session_people (the filter index)
    const { error: sessionPeopleError } = await supabase
      .from("session_people")
      .upsert(
        {
          session_id: sessionId,
          person_id: personId,
          confidence: 1.0, // User-assigned = high confidence
          evidence: { source: "user_assignment", speaker_id: speakerId },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "session_id,person_id",
        }
      );

    if (sessionPeopleError) {
      console.error("Failed to upsert session_people:", sessionPeopleError);
      throw sessionPeopleError;
    }

    // Step 4: Update memory_embeddings metadata
    // Get speaker name from transcript_segments to match metadata
    const { data: segments } = await supabase
      .from("transcript_segments")
      .select("speaker_name")
      .eq("transcript_id", sessionId)
      .eq("speaker_id", speakerId)
      .limit(1);

    const speakerName = segments?.[0]?.speaker_name;

    if (speakerName) {
      // Update embeddings that match this speaker
      const { error: embeddingError } = await supabase.rpc(
        "update_embedding_person_id",
        {
          p_session_id: sessionId,
          p_speaker_name: speakerName,
          p_speaker_id: speakerId,
          p_person_id: personId,
        }
      );

      // If function doesn't exist yet, try direct update
      if (embeddingError?.code === "42883") {
        // Function not found - do direct update
        await supabase
          .from("memory_embeddings")
          .update({
            metadata: supabase.rpc("jsonb_set_nested", {
              target: "metadata",
              path: ["person_id"],
              value: personId,
            }),
          })
          .eq("session_id", sessionId)
          .filter("metadata->>speakerName", "eq", speakerName);
      }
    }

    // Step 5: Log audit event
    await supabase.from("speaker_assignment_events").insert({
      user_id: user.id,
      session_id: sessionId,
      speaker_id: speakerId,
      old_person_id: oldPersonId,
      new_person_id: personId,
    });

    // Fetch the updated speaker info
    const { data: person } = await supabase
      .from("people")
      .select("*")
      .eq("id", personId)
      .single();

    return NextResponse.json({
      success: true,
      personId,
      person,
      speakerId,
    });
  } catch (error) {
    console.error("Speaker assignment failed:", error);
    return NextResponse.json(
      { error: "Failed to assign speaker to person" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/sessions/[id]/speakers/assign
 *
 * Unassign a speaker from a person
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { id: sessionId } = await params;
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
    const { speakerId } = body;

    if (!speakerId) {
      return NextResponse.json(
        { error: "speakerId is required" },
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get current assignment for audit
    const { data: currentSpeaker } = await supabase
      .from("session_speakers")
      .select("person_id")
      .eq("session_id", sessionId)
      .eq("speaker_id", speakerId)
      .single();

    if (!currentSpeaker?.person_id) {
      return NextResponse.json(
        { error: "Speaker not assigned to a person" },
        { status: 400 }
      );
    }

    const oldPersonId = currentSpeaker.person_id;

    // Remove person_id from session_speakers
    await supabase
      .from("session_speakers")
      .update({ person_id: null, updated_at: new Date().toISOString() })
      .eq("session_id", sessionId)
      .eq("speaker_id", speakerId);

    // Check if this person is still associated via other speakers
    const { data: otherSpeakers } = await supabase
      .from("session_speakers")
      .select("id")
      .eq("session_id", sessionId)
      .eq("person_id", oldPersonId);

    // If no other speakers linked to this person, remove from session_people
    if (!otherSpeakers || otherSpeakers.length === 0) {
      await supabase
        .from("session_people")
        .delete()
        .eq("session_id", sessionId)
        .eq("person_id", oldPersonId);
    }

    // Log audit event
    await supabase.from("speaker_assignment_events").insert({
      user_id: user.id,
      session_id: sessionId,
      speaker_id: speakerId,
      old_person_id: oldPersonId,
      new_person_id: null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Speaker unassignment failed:", error);
    return NextResponse.json(
      { error: "Failed to unassign speaker" },
      { status: 500 }
    );
  }
}
