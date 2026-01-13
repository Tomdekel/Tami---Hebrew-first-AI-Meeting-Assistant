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

export interface Note {
  title: string;           // Section title
  emoji: string;           // Icon/emoji for the section
  startTime: string;       // "00:01" format
  endTime: string;         // "05:40" format
  bullets: string[];       // Key points in this section
}

export interface ActionItem {
  description: string;
  assignee: string | null;
  deadline: string | null;
  timestamp: string | null; // When it was mentioned in the meeting
}

export interface SummaryResult {
  overview: string;        // Comprehensive paragraph
  notes: Note[];           // Timestamped sections with emojis
  keyPoints: string[];     // Keep for backwards compatibility
  decisions: Decision[];
  actionItems: ActionItem[];
  topics: string[];
}

interface TranscriptSegment {
  speaker: string;
  text: string;
  timestamp?: string;      // Optional timestamp for better context
}

/**
 * Generate a meeting summary from transcript segments
 */
export async function generateSummary(
  segments: TranscriptSegment[],
  context?: string,
  language: string = "en"
): Promise<SummaryResult> {
  // Format transcript for the prompt with timestamps if available
  const formattedTranscript = segments
    .map((seg) => {
      const ts = seg.timestamp ? `[${seg.timestamp}] ` : "";
      return `${ts}${seg.speaker}: ${seg.text}`;
    })
    .join("\n");

  const isHebrew = language === "he";

  // Enhanced prompt for Fireflies-quality summaries
  const systemPrompt = `You are an expert meeting analyst creating COMPREHENSIVE, DETAILED meeting summaries.

## CRITICAL: Speaker Identification
NEVER use "Speaker 1" or "Speaker 2" in your output. Instead:
- Listen for self-introductions: "אני דניאל" → use "דניאל"
- Listen for names being used: "תום, מה אתה חושב?" → that speaker is "תום"
- Identify roles from context: interviewer, candidate, CEO, manager, data analyst
- Use descriptive roles in Hebrew: "המראיין", "המועמד", "המנכ״ל", "האנליסט"
- Only as absolute last resort: "משתתף א׳", "משתתף ב׳"

## Overview Requirements (DETAILED - 5-7 sentences)
Write a **comprehensive paragraph** that:
- Opens by naming the meeting type and participants BY NAME
- Covers ALL major topics discussed chronologically
- Mentions specific numbers, percentages, and metrics discussed
- Summarizes key findings, conclusions, and next steps
- Reads like a professional meeting brief for executives

Example quality: "בפגישת ניתוח נתונים בנושא 'ניתוח גוסטינג', נבחנה תופעת הגוסטינג... נמצא כי 33% מהמשתמשים שחוו גוסטינג קנו לאחר מכן..."

## Notes Requirements (MANDATORY - Create 3-6 sections)
You MUST create timestamped sections covering the ENTIRE meeting. This is NOT optional.
Each section MUST have:
- **title**: Descriptive Hebrew title (e.g., "ניתוח גוסטינג", "מסקנות והמלצות")
- **emoji**: One emoji: 🔍 📊 🧐 📈 💡 🎯 📋 ❓ 🤖 💼 🏗️
- **startTime**: Exact timestamp when topic starts (from transcript)
- **endTime**: Exact timestamp when topic ends
- **bullets**: 4-6 SPECIFIC bullet points with actual numbers, percentages, names, findings - NOT generic statements

## Action Items
- Use REAL NAMES for assignees - NEVER "Speaker 1"
- If no clear assignee, use "Unassigned"
- Include timestamp when mentioned (HH:MM:SS)
- Include deadline if specified in conversation

## Decisions
- Extract concrete decisions and conclusions
- Include specific numbers and findings

## Key Points
- 3-5 most important takeaways with specifics

## Topics
- Main subjects for tagging

## Language
Output ALL content in ${isHebrew ? "Hebrew" : "the transcript's language"}.`;

  const userPrompt = context
    ? `Meeting Context: ${context}\n\nTranscript:\n${formattedTranscript}`
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
        description: "Save the comprehensive meeting summary",
        parameters: {
          type: "object",
          properties: {
            overview: {
              type: "string",
              description: "COMPREHENSIVE 5-7 sentence overview with participant names, specific numbers/percentages, key findings and conclusions",
            },
            notes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Descriptive Hebrew section title (e.g., 'ניתוח גוסטינג', 'מסקנות והמלצות')",
                  },
                  emoji: {
                    type: "string",
                    description: "Single emoji: 🔍 📊 🧐 📈 💡 🎯 📋 ❓",
                  },
                  startTime: {
                    type: "string",
                    description: "REQUIRED: Exact start timestamp from transcript (HH:MM:SS or MM:SS)",
                  },
                  endTime: {
                    type: "string",
                    description: "REQUIRED: Exact end timestamp from transcript (HH:MM:SS or MM:SS)",
                  },
                  bullets: {
                    type: "array",
                    items: { type: "string" },
                    description: "4-6 SPECIFIC bullet points with actual numbers, percentages, names - NOT generic",
                  },
                },
                required: ["title", "emoji", "startTime", "endTime", "bullets"],
              },
              description: "MANDATORY: 3-6 timestamped sections covering the ENTIRE meeting",
            },
            keyPoints: {
              type: "array",
              items: { type: "string" },
              description: "3-5 most important takeaways from the meeting",
            },
            decisions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: {
                    type: "string",
                    description: "The decision or agreement that was made",
                  },
                  context: {
                    type: "string",
                    nullable: true,
                    description: "Why or how this decision was reached (null if not clear)",
                  },
                },
                required: ["description"],
              },
              description: "Decisions and agreements reached during the meeting",
            },
            actionItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: {
                    type: "string",
                    description: "Clear, specific task description",
                  },
                  assignee: {
                    type: "string",
                    nullable: true,
                    description: "REAL NAME or 'Unassigned'. NEVER use 'Speaker 1' or 'Speaker 2'",
                  },
                  deadline: {
                    type: "string",
                    nullable: true,
                    description: "Deadline if mentioned",
                  },
                  timestamp: {
                    type: "string",
                    nullable: true,
                    description: "REQUIRED: When mentioned in meeting (HH:MM:SS format)",
                  },
                },
                required: ["description"],
              },
              description: "Tasks with REAL NAME assignees (or 'Unassigned') and timestamps",
            },
            topics: {
              type: "array",
              items: { type: "string" },
              description: "Main topics discussed in the meeting (for tagging)",
            },
          },
          required: ["overview", "notes", "keyPoints", "decisions", "actionItems", "topics"],
        },
      },
    ],
    function_call: { name: "save_summary" },
    temperature: 0.4, // Slightly higher for more detailed output
  });

  const functionCall = response.choices[0]?.message?.function_call;

  if (!functionCall?.arguments) {
    throw new Error("Failed to generate summary");
  }

  const result = JSON.parse(functionCall.arguments) as SummaryResult;

  return {
    overview: result.overview || "",
    notes: (result.notes || []).map((note) => ({
      title: note.title || "",
      emoji: note.emoji || "📝",
      startTime: note.startTime || "00:00",
      endTime: note.endTime || "00:00",
      bullets: note.bullets || [],
    })),
    keyPoints: result.keyPoints || [],
    decisions: (result.decisions || []).map((decision) => ({
      description: decision.description,
      context: decision.context || null,
    })),
    actionItems: (result.actionItems || []).map((item) => ({
      description: item.description,
      assignee: item.assignee || null,
      deadline: item.deadline || null,
      timestamp: item.timestamp || null,
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
