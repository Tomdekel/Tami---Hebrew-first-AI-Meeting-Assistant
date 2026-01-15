
import { extractEntities } from "../src/lib/ai/entities";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function runTest() {
    console.log("Starting entity extraction test...");

    // Create a mock transcript with > 25 segments to trigger chunking
    // Include specific entities to test blocklist and extraction
    const segments = [];

    // Chunk 1: Should extract 'Elon Musk' (Person) but ignore 'Google' (Org) and 'AI' (Tech)
    for (let i = 0; i < 15; i++) {
        segments.push({
            speaker: "Speaker 1",
            text: "I was talking to Elon Musk about Google and their AI strategy.",
        });
    }

    // Chunk 2: Should extract 'Project Titan' (Project)
    for (let i = 0; i < 15; i++) {
        segments.push({
            speaker: "Speaker 2",
            text: "We should focus on Project Titan next week.",
        });
    }

    console.log(`Created ${segments.length} segments.`);

    try {
        const result = await extractEntities(segments, "en");
        console.log("\nExtraction Result:");
        console.log(JSON.stringify(result, null, 2));

        // Verification Logic
        const entities = result.entities;

        // Check Blocklist
        const hasGoogle = entities.some(e => e.normalizedValue.toLowerCase().includes("google"));
        const hasAI = entities.some(e => e.normalizedValue.toLowerCase() === "ai");

        if (hasGoogle || hasAI) {
            console.error("❌ Blocklist Failed: Found 'Google' or 'AI' in results.");
        } else {
            console.log("✅ Blocklist Passed: 'Google' and 'AI' were filtered out.");
        }

        // Check Extraction
        const hasElon = entities.some(e => e.normalizedValue.toLowerCase().includes("elon"));
        const hasTitan = entities.some(e => e.normalizedValue.toLowerCase().includes("titan"));

        if (hasElon && hasTitan) {
            console.log("✅ Extraction Passed: Found 'Elon Musk' and 'Project Titan'.");
        } else {
            console.error("❌ Extraction Failed: Missing 'Elon Musk' or 'Project Titan'.");
        }

    } catch (error) {
        console.error("Test Failed:", error);
    }
}

runTest();
