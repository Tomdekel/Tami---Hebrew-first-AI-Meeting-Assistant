import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type ReprocessStep = "transcription" | "summary" | "entities" | "embeddings" | "all";

/**
 * Get the base URL for internal API calls
 * Works on both localhost and Vercel
 */
function getBaseUrl(request: Request): string {
  // First check explicit env var
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Vercel sets this automatically
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Extract from request headers (works in production)
  const host = request.headers.get("host");
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  if (host) {
    return `${protocol}://${host}`;
  }

  // Fallback for local development
  return "http://localhost:3000";
}

/**
 * POST /api/sessions/[id]/reprocess
 * Reprocess a session (re-run transcription, summary, entities, or embeddings)
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

    const body = await request.json();
    const steps: ReprocessStep[] = body.steps || ["all"];

    // Get session
    const { data: session, error: sessionError } = await supabase
      .from("sessions")
      .select("id, user_id, audio_url, status")
      .eq("id", id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.user_id !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const results: Record<string, { success: boolean; message?: string; error?: string }> = {};
    const shouldRunAll = steps.includes("all");

    // 1. Reprocess transcription
    if (shouldRunAll || steps.includes("transcription")) {
      if (!session.audio_url) {
        results.transcription = { success: false, error: "No audio file found" };
      } else {
        try {
          // Update status to processing
          await supabase
            .from("sessions")
            .update({
              status: "processing",
              processing_started_at: new Date().toISOString(),
              transcription_error: null,
              transcription_error_code: null,
              transcription_job_id: null,
            })
            .eq("id", id);

          // Delete existing transcript
          const { data: existingTranscript } = await supabase
            .from("transcripts")
            .select("id")
            .eq("session_id", id)
            .single();

          if (existingTranscript) {
            await supabase
              .from("transcripts")
              .delete()
              .eq("id", existingTranscript.id);
          }

          // Trigger transcription via the transcribe endpoint
          const baseUrl = getBaseUrl(request);
          const transcribeResponse = await fetch(`${baseUrl}/api/sessions/${id}/transcribe`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: request.headers.get("cookie") || "",
            },
          });

          if (transcribeResponse.ok) {
            results.transcription = { success: true, message: "Transcription started" };
          } else {
            const error = await transcribeResponse.json();
            results.transcription = { success: false, error: error.error || "Transcription failed" };
          }
        } catch (error) {
          results.transcription = {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          };
        }
      }
    }

    // 2. Reprocess summary
    if (shouldRunAll || steps.includes("summary")) {
      try {
        // Delete existing summary
        await supabase.from("summaries").delete().eq("session_id", id);

        // Trigger summarization
        const baseUrl = getBaseUrl(request);
        const summaryResponse = await fetch(`${baseUrl}/api/sessions/${id}/summarize`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") || "",
          },
        });

        if (summaryResponse.ok) {
          results.summary = { success: true, message: "Summary generated" };
        } else {
          const error = await summaryResponse.json();
          results.summary = { success: false, error: error.error || "Summary generation failed" };
        }
      } catch (error) {
        results.summary = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // 3. Reprocess entities
    if (shouldRunAll || steps.includes("entities")) {
      try {
        // Delete existing entity mentions for this session
        await supabase.from("entity_mentions").delete().eq("session_id", id);

        // Trigger entity extraction
        const baseUrl = getBaseUrl(request);
        const entitiesResponse = await fetch(`${baseUrl}/api/sessions/${id}/entities`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") || "",
          },
        });

        if (entitiesResponse.ok) {
          const data = await entitiesResponse.json();
          results.entities = {
            success: true,
            message: `Extracted ${data.extractedCount} entities`,
          };
        } else {
          const error = await entitiesResponse.json();
          results.entities = { success: false, error: error.error || "Entity extraction failed" };
        }
      } catch (error) {
        results.entities = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // 4. Reprocess embeddings
    if (shouldRunAll || steps.includes("embeddings")) {
      try {
        // Trigger embedding generation
        const baseUrl = getBaseUrl(request);
        const embeddingsResponse = await fetch(`${baseUrl}/api/sessions/${id}/embeddings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") || "",
          },
        });

        if (embeddingsResponse.ok) {
          const data = await embeddingsResponse.json();
          results.embeddings = {
            success: true,
            message: `Generated ${data.chunksProcessed} embedding chunks`,
          };
        } else {
          const error = await embeddingsResponse.json();
          results.embeddings = { success: false, error: error.error || "Embedding generation failed" };
        }
      } catch (error) {
        results.embeddings = {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // Check overall success
    const allSuccessful = Object.values(results).every((r) => r.success);
    const anySuccessful = Object.values(results).some((r) => r.success);

    return NextResponse.json({
      success: anySuccessful,
      results,
      message: allSuccessful
        ? "All reprocessing steps completed successfully"
        : anySuccessful
        ? "Some reprocessing steps completed"
        : "Reprocessing failed",
    });
  } catch (error) {
    console.error("Reprocess error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
