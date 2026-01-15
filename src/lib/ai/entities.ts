import OpenAI from "openai";
import blocklistConfig from "@/config/entity-blocklist.json";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export type EntityType =
  | "person"
  | "organization"
  | "project"
  | "topic"
  | "location"
  | "date"
  | "product"
  | "technology"
  | "other";

/**
 * Blocklist of generic/noisy organizations and technologies.
 * Imported from configuration file.
 */
const BLOCKLIST_ORGANIZATIONS = new Set(blocklistConfig.organizations);
const BLOCKLIST_TECHNOLOGY = new Set(blocklistConfig.technologies);

/**
 * Check if an entity should be filtered out based on blocklists
 */
function shouldFilterEntity(entity: { type: string; normalizedValue: string }): boolean {
  const normalized = entity.normalizedValue.toLowerCase().trim();

  if (entity.type === "organization" && BLOCKLIST_ORGANIZATIONS.has(normalized)) {
    return true;
  }

  if ((entity.type === "technology" || entity.type === "product") && BLOCKLIST_TECHNOLOGY.has(normalized)) {
    return true;
  }

  return false;
}

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  normalizedValue: string;
  mentions: number;
  context: string;
}

export interface EntityExtractionResult {
  entities: ExtractedEntity[];
}

interface TranscriptSegment {
  speaker: string;
  text: string;
}

const CHUNK_SIZE_SEGMENTS = 25; // Approx 10-15 mins of conversation per chunk

/**
 * Extract entities from transcript using GPT-4o-mini
 * Implements chunking for large transcripts
 */
export async function extractEntities(
  segments: TranscriptSegment[],
  language: string = "en"
): Promise<EntityExtractionResult> {
  // Split segments into chunks to avoid token limits
  const chunks: TranscriptSegment[][] = [];
  for (let i = 0; i < segments.length; i += CHUNK_SIZE_SEGMENTS) {
    chunks.push(segments.slice(i, i + CHUNK_SIZE_SEGMENTS));
  }

  const allEntities: ExtractedEntity[] = [];

  // Process chunks in parallel (with some concurrency limit if needed, but 3-4 chunks is usually fine)
  // For very long meetings, we might want to process sequentially or semi-parallel
  console.log(`[extractEntities] Processing ${chunks.length} chunks...`);
  const results = await Promise.all(
    chunks.map((chunk) => extractEntitiesFromChunk(chunk, language))
  );

  // Merge results
  for (const result of results) {
    allEntities.push(...result.entities);
  }

  // Deduplicate and aggregate mentions across chunks
  const mergedEntities = mergeEntities(allEntities);

  return { entities: mergedEntities };
}

async function extractEntitiesFromChunk(
  chunk: TranscriptSegment[],
  language: string
): Promise<EntityExtractionResult> {
  const formattedTranscript = chunk
    .map((seg) => `${seg.speaker}: ${seg.text}`)
    .join("\n");

  const isHebrew = language === "he";

  const systemPrompt = isHebrew
    ? `אתה מומחה בחילוץ ישויות מתמלולי פגישות.

חלץ רק את הישויות הבאות:
- אנשים (person): שמות של אנשים אמיתיים (לא "דובר 1", "Speaker 2")
- ארגונים (organization): חברות, צוותים, מחלקות עם שמות ספציפיים
- פרויקטים (project): שמות של פרויקטים או יוזמות ספציפיות
- נושאים (topic): נושאים מרכזיים שנדונו בעומק (לא אזכורים חולפים)
- מיקומים (location): מקומות גיאוגרפיים ספציפיים
- תאריכים (date): תאריכים ספציפיים בלבד (לא משכי זמן כמו "שבוע", "חודש", "שעות")
- מוצרים (product): שמות מוצרים ספציפיים
- טכנולוגיות (technology): טכנולוגיות, כלים, שפות תכנות ספציפיות

אל תחלץ:
- תוויות דוברים ("דובר 1", "Speaker 2")
- יחסים משפחתיים ("אשתי", "החבר", "המנהל")
- משכי זמן ("שבוע", "חודש", "שעות", "ימים")
- התייחסויות כלליות ("החברה", "המוצר", "הפרויקט")
- מילים גנריות מדי כמו "AI", "conversion"

החזר ישויות ייחודיות בלבד. נרמל שמות (למשל "דני" ו"דניאל" -> "דניאל").`
    : `You are an expert at extracting entities from meeting transcripts.

Extract ONLY these entities:
- person: Real people's names (NOT "Speaker 1", "Speaker 2")
- organization: Companies, teams, departments with specific names
- project: Specific project or initiative names
- topic: Major topics discussed in depth (not passing mentions)
- location: Specific geographic places
- date: Specific dates ONLY (NOT durations like "a week", "month", "hours")
- product: Specific product names
- technology: Specific technologies, tools, programming languages

DO NOT extract:
- Speaker labels ("Speaker 1", "Speaker 2", "דובר 1")
- Relationships ("my wife", "the manager", "his friend")
- Time durations ("week", "month", "few days", "hours", "next month")
- Generic references ("the company", "the product", "the project")
- Overly generic terms like "AI", "conversion", "growth"

Return unique entities only. Normalize names (e.g., "Dan" and "Danny" -> "Daniel").`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Extract entities from this transcript:\n\n${formattedTranscript}` },
    ],
    functions: [
      {
        name: "save_entities",
        description: "Save extracted entities",
        parameters: {
          type: "object",
          properties: {
            entities: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  type: {
                    type: "string",
                    enum: [
                      "person",
                      "organization",
                      "project",
                      "topic",
                      "location",
                      "date",
                      "product",
                      "technology",
                      "other",
                    ],
                    description: "The type of entity",
                  },
                  value: {
                    type: "string",
                    description: "The entity as it appears in text",
                  },
                  normalizedValue: {
                    type: "string",
                    description: "Normalized/canonical form of the entity",
                  },
                  mentions: {
                    type: "number",
                    description: "Approximate number of times mentioned in this chunk",
                  },
                  context: {
                    type: "string",
                    description: "Brief context about how this entity was discussed",
                  },
                },
                required: ["type", "value", "normalizedValue", "mentions"],
              },
            },
          },
          required: ["entities"],
        },
      },
    ],
    function_call: { name: "save_entities" },
    temperature: 0.2,
  });

  const functionCall = response.choices[0]?.message?.function_call;

  if (!functionCall?.arguments) {
    return { entities: [] };
  }

  const result = JSON.parse(functionCall.arguments) as EntityExtractionResult;

  // Filter out blocklisted entities
  const filteredEntities = (result.entities || [])
    .filter((entity) => !shouldFilterEntity(entity));

  return { entities: filteredEntities };
}

/**
 * Merge entities extracted from different chunks
 */
function mergeEntities(entities: ExtractedEntity[]): ExtractedEntity[] {
  const mergedMap = new Map<string, ExtractedEntity>();

  for (const entity of entities) {
    const key = `${entity.type}:${entity.normalizedValue.toLowerCase()}`;

    if (mergedMap.has(key)) {
      const existing = mergedMap.get(key)!;
      existing.mentions += entity.mentions;
      // Keep the longer/more descriptive context or just append
      if (entity.context.length > existing.context.length) {
        existing.context = entity.context;
      }
    } else {
      mergedMap.set(key, { ...entity });
    }
  }

  return Array.from(mergedMap.values());
}

