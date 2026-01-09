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

export type RelationshipType =
  | "WORKS_AT"
  | "MANAGES"
  | "COLLABORATES_WITH"
  | "REPORTS_TO"
  | "USES"
  | "RELATED_TO"
  | "DEPENDS_ON"
  | "LOCATED_IN"
  | "ASSIGNED_TO"
  | "SCHEDULED_FOR";

// Whitelist of valid relationship types for security (prevents Cypher injection)
export const VALID_RELATIONSHIP_TYPES: readonly string[] = [
  "WORKS_AT", "MANAGES", "COLLABORATES_WITH", "REPORTS_TO",
  "USES", "RELATED_TO", "DEPENDS_ON", "LOCATED_IN",
  "ASSIGNED_TO", "SCHEDULED_FOR"
];

export function isValidRelationshipType(type: string): type is RelationshipType {
  return VALID_RELATIONSHIP_TYPES.includes(type);
}

export interface ExtractedRelationship {
  sourceType: string;
  sourceValue: string;
  targetType: string;
  targetValue: string;
  relationshipType: RelationshipType;
  confidence: number;
  context: string;
}

export interface RelationshipExtractionResult {
  relationships: ExtractedRelationship[];
}

interface EntityInfo {
  type: string;
  value: string;
  normalizedValue: string;
}

/**
 * Extract relationships between entities using GPT-4o-mini
 */
export async function extractRelationships(
  transcript: string,
  entities: EntityInfo[],
  language: string = "en"
): Promise<RelationshipExtractionResult> {
  // If no entities or very few, no relationships to extract
  if (entities.length < 2) {
    return { relationships: [] };
  }

  const entityList = entities
    .map((e) => `- ${e.type}: ${e.value}`)
    .join("\n");

  const isHebrew = language === "he";

  const systemPrompt = isHebrew
    ? `אתה מומחה בזיהוי קשרים בין ישויות בתמלולי פגישות.

סוגי קשרים אפשריים:
- WORKS_AT: אדם עובד בארגון
- MANAGES: אדם מנהל פרויקט או צוות
- COLLABORATES_WITH: אדם עובד עם אדם אחר
- REPORTS_TO: אדם מדווח לאדם אחר
- USES: פרויקט משתמש בטכנולוגיה
- RELATED_TO: קשר כללי בין ישויות
- DEPENDS_ON: פרויקט/טכנולוגיה תלויים באחר
- LOCATED_IN: ארגון/אדם נמצא במיקום
- ASSIGNED_TO: אדם מוקצה למשימה
- SCHEDULED_FOR: פריט מתוזמן לתאריך

החזר רק קשרים שהוזכרו במפורש בתמליל. אל תסיק קשרים שלא נאמרו.
confidence צריך להיות בין 0.5 ל-1.0.`
    : `You are an expert at identifying relationships between entities in meeting transcripts.

Possible relationship types:
- WORKS_AT: Person works at Organization
- MANAGES: Person manages Project or team
- COLLABORATES_WITH: Person works with another Person
- REPORTS_TO: Person reports to another Person
- USES: Project uses Technology
- RELATED_TO: General relation between entities
- DEPENDS_ON: Project/Technology depends on another
- LOCATED_IN: Organization/Person is located at Location
- ASSIGNED_TO: Person is assigned to task
- SCHEDULED_FOR: Item is scheduled for Date

Only return relationships explicitly mentioned in the transcript. Do not infer relationships that weren't stated.
confidence should be between 0.5 and 1.0.`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: `Known entities:\n${entityList}\n\nTranscript:\n${transcript}\n\nExtract relationships between these entities based on the transcript.`,
      },
    ],
    functions: [
      {
        name: "save_relationships",
        description: "Save extracted relationships between entities",
        parameters: {
          type: "object",
          properties: {
            relationships: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  sourceType: {
                    type: "string",
                    description: "Type of the source entity (person, organization, etc.)",
                  },
                  sourceValue: {
                    type: "string",
                    description: "Value/name of the source entity",
                  },
                  targetType: {
                    type: "string",
                    description: "Type of the target entity",
                  },
                  targetValue: {
                    type: "string",
                    description: "Value/name of the target entity",
                  },
                  relationshipType: {
                    type: "string",
                    enum: [
                      "WORKS_AT",
                      "MANAGES",
                      "COLLABORATES_WITH",
                      "REPORTS_TO",
                      "USES",
                      "RELATED_TO",
                      "DEPENDS_ON",
                      "LOCATED_IN",
                      "ASSIGNED_TO",
                      "SCHEDULED_FOR",
                    ],
                    description: "The type of relationship",
                  },
                  confidence: {
                    type: "number",
                    description: "Confidence level 0.5-1.0",
                  },
                  context: {
                    type: "string",
                    description: "Brief quote or context for this relationship",
                  },
                },
                required: [
                  "sourceType",
                  "sourceValue",
                  "targetType",
                  "targetValue",
                  "relationshipType",
                ],
              },
            },
          },
          required: ["relationships"],
        },
      },
    ],
    function_call: { name: "save_relationships" },
    temperature: 0.2,
  });

  const functionCall = response.choices[0]?.message?.function_call;

  if (!functionCall?.arguments) {
    return { relationships: [] };
  }

  const result = JSON.parse(functionCall.arguments) as RelationshipExtractionResult;

  return {
    relationships: (result.relationships || []).map((rel) => ({
      sourceType: rel.sourceType,
      sourceValue: rel.sourceValue,
      targetType: rel.targetType,
      targetValue: rel.targetValue,
      relationshipType: rel.relationshipType,
      confidence: rel.confidence ?? 0.8,
      context: rel.context || "",
    })),
  };
}
