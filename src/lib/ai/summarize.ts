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

export interface Decision {
  description: string;
  context: string | null; // Why this decision was made
}

export interface SummaryResult {
  overview: string;
  keyPoints: string[];
  decisions: Decision[];
  actionItems: ActionItem[];
  topics: string[];
}

export interface ActionItem {
  description: string;
  assignee: string | null;
  deadline: string | null;
}

interface TranscriptSegment {
  speaker: string;
  text: string;
}

/**
 * Generate a meeting summary from transcript segments
 */
export async function generateSummary(
  segments: TranscriptSegment[],
  context?: string,
  language: string = "en"
): Promise<SummaryResult> {
  // Format transcript for the prompt
  const formattedTranscript = segments
    .map((seg) => `${seg.speaker}: ${seg.text}`)
    .join("\n");

  const isHebrew = language === "he";

  const systemPrompt = isHebrew
    ? `אתה עוזר מועיל שמסכם פגישות. תפקידך לנתח תמלולי פגישות ולספק:
1. סיכום תמציתי (2-3 משפטים)
2. נקודות מפתח (3-5 נקודות)
3. החלטות שהתקבלו בפגישה (כולל הקשר אם רלוונטי)
4. פריטי פעולה עם מוטב ותאריך יעד אם צוינו
5. נושאים עיקריים שנדונו

השב בעברית. היה תמציתי וממוקד. הבחן בין החלטות (מסקנות שהוסכמו) לבין פריטי פעולה (משימות לביצוע).`
    : `You are a helpful assistant that summarizes meetings. Your task is to analyze meeting transcripts and provide:
1. A concise overview (2-3 sentences)
2. Key points (3-5 bullet points)
3. Decisions made during the meeting (with context if relevant)
4. Action items with assignee and deadline if mentioned
5. Main topics discussed

Be concise and focused. Distinguish between decisions (agreed conclusions) and action items (tasks to be done).`;

  const userPrompt = context
    ? `Context: ${context}\n\nTranscript:\n${formattedTranscript}`
    : `Transcript:\n${formattedTranscript}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    functions: [
      {
        name: "save_summary",
        description: "Save the meeting summary",
        parameters: {
          type: "object",
          properties: {
            overview: {
              type: "string",
              description: "A 2-3 sentence overview of the meeting",
            },
            keyPoints: {
              type: "array",
              items: { type: "string" },
              description: "3-5 key points from the meeting",
            },
            decisions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: {
                    type: "string",
                    description: "The decision that was made",
                  },
                  context: {
                    type: "string",
                    nullable: true,
                    description: "Why or how this decision was reached (null if not clear)",
                  },
                },
                required: ["description"],
              },
              description: "Decisions made during the meeting (conclusions, agreements, choices)",
            },
            actionItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: {
                    type: "string",
                    description: "What needs to be done",
                  },
                  assignee: {
                    type: "string",
                    nullable: true,
                    description: "Who is responsible (null if not specified)",
                  },
                  deadline: {
                    type: "string",
                    nullable: true,
                    description: "When it's due (null if not specified)",
                  },
                },
                required: ["description"],
              },
              description: "Action items extracted from the meeting (tasks to be done)",
            },
            topics: {
              type: "array",
              items: { type: "string" },
              description: "Main topics discussed in the meeting",
            },
          },
          required: ["overview", "keyPoints", "decisions", "actionItems", "topics"],
        },
      },
    ],
    function_call: { name: "save_summary" },
    temperature: 0.3,
  });

  const functionCall = response.choices[0]?.message?.function_call;

  if (!functionCall?.arguments) {
    throw new Error("Failed to generate summary");
  }

  const result = JSON.parse(functionCall.arguments) as SummaryResult;

  return {
    overview: result.overview || "",
    keyPoints: result.keyPoints || [],
    decisions: (result.decisions || []).map((decision) => ({
      description: decision.description,
      context: decision.context || null,
    })),
    actionItems: (result.actionItems || []).map((item) => ({
      description: item.description,
      assignee: item.assignee || null,
      deadline: item.deadline || null,
    })),
    topics: result.topics || [],
  };
}

/**
 * Answer a question about the meeting
 */
export async function answerQuestion(
  question: string,
  segments: TranscriptSegment[],
  context?: string,
  language: string = "en"
): Promise<string> {
  const formattedTranscript = segments
    .map((seg) => `${seg.speaker}: ${seg.text}`)
    .join("\n");

  const isHebrew = language === "he";

  const systemPrompt = isHebrew
    ? `אתה עוזר מועיל שעונה על שאלות לגבי פגישות. בהינתן תמלול פגישה, ענה על שאלות המשתמש בצורה תמציתית ומדויקת. אם המידע לא מופיע בתמלול, אמור זאת בבירור. השב בעברית.`
    : `You are a helpful assistant that answers questions about meetings. Given a meeting transcript, answer the user's questions concisely and accurately. If the information is not in the transcript, say so clearly.`;

  const userPrompt = context
    ? `Context: ${context}\n\nTranscript:\n${formattedTranscript}\n\nQuestion: ${question}`
    : `Transcript:\n${formattedTranscript}\n\nQuestion: ${question}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || "Unable to answer the question.";
}
