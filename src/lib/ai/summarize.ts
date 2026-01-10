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

  // Single English prompt that outputs in the appropriate language
  const systemPrompt = `You are a meeting summarization expert. Analyze meeting transcripts and provide comprehensive summaries.

Your task is to create:

1. **Overview**: A comprehensive paragraph (4-6 sentences) summarizing the main topics, participants, key outcomes, and overall purpose of the meeting. This should give someone who didn't attend a complete picture.

2. **Notes**: Divide the meeting into 4-8 major topic sections. Each section needs:
   - A descriptive title (in the transcript's language)
   - An appropriate emoji from this list:
     🤝 Introductions/personal updates
     📈 Business achievements/results
     🏗️ Roles/team structure
     🤖 AI/technology discussions
     💼 Business opportunities
     💰 Compensation/salary terms
     🎯 Goals/strategy
     📋 Projects/deliverables
     💡 Ideas/brainstorming
     ❓ Q&A/discussions
   - Time range (start - end) based on transcript timestamps
   - 2-4 bullet points summarizing key information in that section

3. **Action Items**: Tasks that need to be done, grouped by assignee. Include:
   - Clear task description
   - Who is responsible
   - When it was mentioned (timestamp)
   - Deadline if specified

4. **Decisions**: Conclusions or agreements reached during the meeting.

5. **Key Points**: 3-5 most important takeaways (for backwards compatibility).

6. **Topics**: Main subjects discussed (for tagging).

IMPORTANT: Output all text content in ${isHebrew ? "Hebrew" : "English"} (matching the transcript language).`;

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
              description: "A comprehensive 4-6 sentence overview of the meeting covering main topics, participants, and outcomes",
            },
            notes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: {
                    type: "string",
                    description: "Descriptive section title",
                  },
                  emoji: {
                    type: "string",
                    description: "Single emoji representing the section topic",
                  },
                  startTime: {
                    type: "string",
                    description: "Start time in MM:SS or HH:MM:SS format",
                  },
                  endTime: {
                    type: "string",
                    description: "End time in MM:SS or HH:MM:SS format",
                  },
                  bullets: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-4 key points from this section",
                  },
                },
                required: ["title", "emoji", "startTime", "endTime", "bullets"],
              },
              description: "4-8 timestamped sections covering major topics",
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
                    description: "What needs to be done",
                  },
                  assignee: {
                    type: "string",
                    nullable: true,
                    description: "Who is responsible for this task",
                  },
                  deadline: {
                    type: "string",
                    nullable: true,
                    description: "When it's due (null if not specified)",
                  },
                  timestamp: {
                    type: "string",
                    nullable: true,
                    description: "When this action item was mentioned in the meeting (MM:SS format)",
                  },
                },
                required: ["description"],
              },
              description: "Tasks to be done, with assignee and optional deadline",
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
    temperature: 0.3,
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
