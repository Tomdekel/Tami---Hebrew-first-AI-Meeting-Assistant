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

export interface EvidenceQuote {
  quoteId: string;
  text: string;
  speaker?: string | null;
  meetingId: string;
  meetingTitle?: string | null;
  tStart?: number | null;
  tEnd?: number | null;
  segmentId?: string | null;
  sourceType: "meeting" | "doc" | "summary";
  docId?: string | null;
  chunkId?: string | null;
}

export interface AiAnswerParagraph {
  text: string;
  citations: Array<{ quoteId?: string; chunkId?: string }>;
}

export interface AiAnswer {
  paragraphs: AiAnswerParagraph[];
}

function validateAnswer(answer: AiAnswer | null): AiAnswer | null {
  if (!answer || !Array.isArray(answer.paragraphs) || answer.paragraphs.length === 0) {
    return null;
  }

  const validParagraphs = answer.paragraphs.filter((paragraph) => {
    if (!paragraph?.text || !Array.isArray(paragraph.citations)) return false;
    return paragraph.citations.length > 0;
  });

  if (validParagraphs.length === 0) return null;
  return { paragraphs: validParagraphs };
}

export async function generateAiAnswerFromEvidence(
  question: string,
  evidence: EvidenceQuote[],
  language: "en" | "he"
): Promise<AiAnswer | null> {
  if (evidence.length === 0) return null;

  const isHebrew = language === "he";
  const evidencePayload = evidence.map((item) => ({
    quoteId: item.quoteId,
    chunkId: item.chunkId,
    text: item.text,
    speaker: item.speaker || null,
    meetingTitle: item.meetingTitle || null,
    tStart: item.tStart ?? null,
    tEnd: item.tEnd ?? null,
    sourceType: item.sourceType,
  }));

  const systemPrompt = isHebrew
    ? "אתה עוזר שעונה על שאלות אך ורק על בסיס הראיות שסופקו. עבור כל פסקה חייבות להיות ציטוטים שמפנים ל-quoteId או chunkId מהרשימה. אם אין ראיות מספקות, אל תענה."
    : "You answer questions using ONLY the provided evidence. Each paragraph MUST include citations referencing quoteId or chunkId from the evidence list. If evidence is insufficient, do not answer.";

  const userPrompt = {
    question,
    evidence: evidencePayload,
    output: {
      paragraphs: [
        {
          text: "string",
          citations: [{ quoteId: "q_123" }, { chunkId: "ch_123" }],
        },
      ],
    },
  };

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(userPrompt) },
      ],
      temperature: 0.2,
      max_tokens: 600,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ai_answer",
          schema: {
            type: "object",
            properties: {
              paragraphs: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    citations: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          quoteId: { type: "string" },
                          chunkId: { type: "string" },
                        },
                        additionalProperties: false,
                      },
                      minItems: 1,
                    },
                  },
                  required: ["text", "citations"],
                  additionalProperties: false,
                },
                minItems: 1,
              },
            },
            required: ["paragraphs"],
            additionalProperties: false,
          },
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as AiAnswer;
    return validateAnswer(parsed);
  } catch (error) {
    console.error("AI evidence answer failed:", error);
    return null;
  }
}
