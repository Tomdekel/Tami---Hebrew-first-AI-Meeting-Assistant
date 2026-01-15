
import { createClient } from "@supabase/supabase-js";
import neo4j from "neo4j-driver";
import dotenv from "dotenv";
import path from "path";

// Explicitly load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.log("⚠️ Could not load .env.local file");
} else {
    console.log("Loaded .env.local");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const neo4jUri = process.env.NEO4J_URI;
const neo4jUser = process.env.NEO4J_USERNAME;
const neo4jPassword = process.env.NEO4J_PASSWORD;

async function checkSupabase() {
    console.log("\n--- Checking Supabase ---");
    if (!supabaseUrl || !supabaseKey) {
        console.error("❌ Missing Supabase variables (NEXT_PUBLIC_SUPABASE_URL or keys).");
        return;
    }
    console.log(`URL: ${supabaseUrl}`);
    try {
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Try to fetch session count (head only)
        const { count, error } = await supabase.from('sessions').select('*', { count: 'exact', head: true });

        if (error) {
            console.error("❌ Connection failed with error:", error.message);
        } else {
            console.log(`✅ Connection successful! Found ${count} sessions.`);
        }
    } catch (e: any) {
        console.error("❌ Exception during connection:", e.message);
    }
}

async function checkNeo4j() {
    console.log("\n--- Checking Neo4j ---");
    if (!neo4jUri || !neo4jUser || !neo4jPassword) {
        console.error("❌ Missing Neo4j variables (NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD).");
        return;
    }
    console.log(`URI: ${neo4jUri}`);
    console.log(`User: ${neo4jUser}`);

    let driver;
    try {
        driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
        const serverInfo = await driver.getServerInfo();
        console.log(`✅ Connection successful! Agent: ${serverInfo.agent}`);

        // Try a simple read
        const session = driver.session();
        const res = await session.run("MATCH (n) RETURN count(n) as count");
        const count = res.records[0].get('count').toNumber();
        console.log(`   Graph contains ${count} nodes.`);
        await session.close();

    } catch (e: any) {
        console.error("❌ Connection failed:", e.message);
    } finally {
        if (driver) await driver.close();
    }
}

async function main() {
    await checkSupabase();
    await checkNeo4j();
}

main();
