import OpenAI from "openai";

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

/**
 * Extract entities from transcript using GPT-4o-mini
 */
export async function extractEntities(
  segments: TranscriptSegment[],
  language: string = "en"
): Promise<EntityExtractionResult> {
  const formattedTranscript = segments
    .map((seg) => `${seg.speaker}: ${seg.text}`)
    .join("\n");

  const isHebrew = language === "he";

  const systemPrompt = isHebrew
    ? `אתה מומחה בחילוץ ישויות מתמלולי פגישות. זהה את הישויות הבאות:
- אנשים (person): שמות של אנשים שהוזכרו
- ארגונים (organization): חברות, צוותים, מחלקות
- פרויקטים (project): שמות של פרויקטים או יוזמות
- נושאים (topic): נושאים מרכזיים שנדונו
- מיקומים (location): מקומות שהוזכרו
- תאריכים (date): תאריכים או זמנים ספציפיים
- מוצרים (product): שמות מוצרים
- טכנולוגיות (technology): טכנולוגיות, כלים, שפות תכנות

החזר ישויות ייחודיות בלבד. נרמל שמות (למשל "דני" ו"דניאל" -> "דניאל").`
    : `You are an expert at extracting entities from meeting transcripts. Identify the following entities:
- person: Names of people mentioned
- organization: Companies, teams, departments
- project: Names of projects or initiatives
- topic: Main topics discussed
- location: Places mentioned
- date: Specific dates or times mentioned
- product: Product names
- technology: Technologies, tools, programming languages

Return unique entities only. Normalize names (e.g., "Dan" and "Danny" -> "Daniel" if referring to same person).`;

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
                    description: "Approximate number of times mentioned",
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

  return {
    entities: (result.entities || []).map((entity) => ({
      type: entity.type,
      value: entity.value,
      normalizedValue: entity.normalizedValue || entity.value,
      mentions: entity.mentions || 1,
      context: entity.context || "",
    })),
  };
}
