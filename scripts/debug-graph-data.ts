
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugGraph() {
    console.log("--- Debugging Graph Data ---");

    // 1. Count Sessions
    const { count: sessionCount } = await supabase.from("sessions").select("*", { count: 'exact', head: true });
    console.log(`Total Sessions: ${sessionCount}`);

    // 2. Count Entities
    const { count: entityCount } = await supabase.from("entities").select("*", { count: 'exact', head: true });
    console.log(`Total Entities: ${entityCount}`);

    // 3. Count Mentions
    const { data: mentions, error } = await supabase.from("entity_mentions").select("session_id, entity_id");

    if (error) {
        console.error("Error fetching mentions:", error);
        return;
    }

    console.log(`Total Mentions: ${mentions.length}`);

    // 4. Analyze Co-occurrence
    const sessionToEntities = new Map();
    mentions.forEach(m => {
        if (!sessionToEntities.has(m.session_id)) {
            sessionToEntities.set(m.session_id, new Set());
        }
        sessionToEntities.get(m.session_id).add(m.entity_id);
    });

    let sessionsWithMultiple = 0;
    let potentialEdges = 0;

    for (const [sessionId, entities] of sessionToEntities) {
        if (entities.size > 1) {
            sessionsWithMultiple++;
            // n * (n-1) / 2 edges
            potentialEdges += (entities.size * (entities.size - 1)) / 2;
        }
    }

    console.log(`Sessions with >1 entity: ${sessionsWithMultiple}`);
    console.log(`Potential Edges (Co-occurrences): ${potentialEdges}`);

    if (potentialEdges === 0) {
        console.log("⚠️ CONCLUSION: The graph is disconnected because no sessions contain more than 1 entity (or entities are unique per session).");
    } else {
        console.log("✅ CONCLUSION: Data exists for a connected graph. The API logic might be filtering it out.");
    }
}

debugGraph();
