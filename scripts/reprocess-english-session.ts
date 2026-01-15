
import { createClient } from "@supabase/supabase-js";
import { initializePipelineState, runMeetingIngestionPipeline } from "@/lib/pipelines/meeting-ingestion";
import dotenv from "dotenv";

// Load env vars
dotenv.config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const SESSION_ID = "5e9a6686-61a3-42e3-ac55-f293418b1943";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});

async function main() {
    console.log(`Force reprocessing session ${SESSION_ID} as English...`);

    // 1. Get session
    const { data: session, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("id", SESSION_ID)
        .single();

    if (error || !session) {
        console.error("Session not found:", error);
        process.exit(1);
    }

    console.log("Found session:", session.title);

    // 2. Clean up existing data (simulate reprocess route)
    console.log("Cleaning up existing data...");
    await supabase.from("entity_mentions").delete().eq("session_id", SESSION_ID);
    await supabase.from("memory_embeddings").delete().eq("session_id", SESSION_ID);
    await supabase.from("action_items").delete().eq("session_id", SESSION_ID);
    await supabase.from("summaries").delete().eq("session_id", SESSION_ID);
    await supabase.from("transcripts").delete().eq("session_id", SESSION_ID);

    // 3. Update detected_language to 'en' and status to 'failed' to allow retry
    console.log("Updating detected_language to 'en' and status to 'failed'...");
    await supabase
        .from("sessions")
        .update({
            detected_language: "en",
            status: "failed",
            processing_state: "failed",
            transcription_job_id: null
        })
        .eq("id", SESSION_ID);

    console.log("Session updated. Please go to the UI and click 'Retry' for this meeting. It will now transcribe in English.");
}

main().catch(console.error);
