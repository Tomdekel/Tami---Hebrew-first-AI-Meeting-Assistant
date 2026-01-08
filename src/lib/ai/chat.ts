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

export interface TranscriptSegment {
  speaker: string;
  text: string;
}

export interface RetrievedContext {
  content: string;
  sourceType: "transcript" | "attachment";
  sourceName?: string;
  similarity: number;
}

/**
 * Answer a question using retrieved context from embeddings (RAG)
 */
export async function answerQuestionWithContext(
  question: string,
  retrievedContext: RetrievedContext[],
  transcriptSegments: TranscriptSegment[],
  sessionContext?: string,
  language: string = "en"
): Promise<string> {
  const isHebrew = language === "he";

  // Build context from retrieved chunks
  const contextParts: string[] = [];

  // Group by source type
  const transcriptChunks = retrievedContext.filter(c => c.sourceType === "transcript");
  const attachmentChunks = retrievedContext.filter(c => c.sourceType === "attachment");

  if (transcriptChunks.length > 0) {
    const transcriptContext = transcriptChunks
      .map(c => c.content)
      .join("\n\n");
    contextParts.push(isHebrew
      ? `מהתמלול:\n${transcriptContext}`
      : `From transcript:\n${transcriptContext}`);
  }

  if (attachmentChunks.length > 0) {
    // Group by source file
    const byFile = new Map<string, string[]>();
    for (const chunk of attachmentChunks) {
      const fileName = chunk.sourceName || "Attached document";
      if (!byFile.has(fileName)) {
        byFile.set(fileName, []);
      }
      byFile.get(fileName)!.push(chunk.content);
    }

    for (const [fileName, chunks] of byFile) {
      contextParts.push(isHebrew
        ? `מהמסמך "${fileName}":\n${chunks.join("\n\n")}`
        : `From "${fileName}":\n${chunks.join("\n\n")}`);
    }
  }

  // If no relevant context found, fall back to full transcript
  let finalContext: string;
  if (contextParts.length === 0) {
    const formattedTranscript = transcriptSegments
      .map(seg => `${seg.speaker}: ${seg.text}`)
      .join("\n");
    finalContext = isHebrew
      ? `תמלול הפגישה:\n${formattedTranscript}`
      : `Meeting transcript:\n${formattedTranscript}`;
  } else {
    finalContext = contextParts.join("\n\n---\n\n");
  }

  const systemPrompt = isHebrew
    ? `אתה עוזר מועיל שעונה על שאלות לגבי פגישות. בהינתן קטעים רלוונטיים מתמלול הפגישה ומסמכים מצורפים, ענה על שאלות המשתמש בצורה תמציתית ומדויקת.

אם התשובה מבוססת על מסמך מצורף, ציין את שם המסמך בתשובה.
אם המידע לא מופיע בחומר שסופק, אמור זאת בבירור.
השב בעברית.`
    : `You are a helpful assistant that answers questions about meetings. Given relevant excerpts from the meeting transcript and attached documents, answer the user's questions concisely and accurately.

If the answer comes from an attached document, mention the document name in your response.
If the information is not in the provided material, say so clearly.`;

  const userPrompt = sessionContext
    ? `${isHebrew ? "הקשר הפגישה" : "Meeting context"}: ${sessionContext}\n\n${finalContext}\n\n${isHebrew ? "שאלה" : "Question"}: ${question}`
    : `${finalContext}\n\n${isHebrew ? "שאלה" : "Question"}: ${question}`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content || (isHebrew ? "לא ניתן לענות על השאלה." : "Unable to answer the question.");
}

// Global Memory Chat types and function
export interface GlobalRetrievedContext {
  content: string;
  sourceType: "transcript" | "attachment";
  sourceName?: string;
  sessionId: string;
  sessionTitle: string;
  sessionDate?: string;
  speakerName?: string;
  startTime?: number;
  similarity: number;
}

export interface GlobalChatSource {
  sessionId: string;
  sessionTitle: string;
  sessionDate?: string;
  excerpts: string[];
}

/**
 * Answer a question using context from multiple sessions (Global Memory)
 */
export async function answerGlobalQuestion(
  question: string,
  retrievedContext: GlobalRetrievedContext[],
  language: string = "en"
): Promise<{ answer: string; sources: GlobalChatSource[] }> {
  const isHebrew = language === "he";

  // Group context by session for better organization
  const bySession = new Map<string, {
    title: string;
    date?: string;
    chunks: GlobalRetrievedContext[];
  }>();

  for (const chunk of retrievedContext) {
    if (!bySession.has(chunk.sessionId)) {
      bySession.set(chunk.sessionId, {
        title: chunk.sessionTitle,
        date: chunk.sessionDate,
        chunks: [],
      });
    }
    bySession.get(chunk.sessionId)!.chunks.push(chunk);
  }

  // Build context with session attribution
  const contextParts: string[] = [];
  const sources: GlobalChatSource[] = [];

  for (const [sessionId, data] of bySession) {
    const sessionLabel = data.date
      ? `${data.title} (${data.date})`
      : data.title;

    const transcriptChunks = data.chunks.filter(c => c.sourceType === "transcript");
    const attachmentChunks = data.chunks.filter(c => c.sourceType === "attachment");

    const excerpts: string[] = [];

    if (transcriptChunks.length > 0) {
      const content = transcriptChunks
        .map(c => {
          const speaker = c.speakerName ? `${c.speakerName}: ` : "";
          return `${speaker}${c.content}`;
        })
        .join("\n");
      contextParts.push(isHebrew
        ? `מפגישה "${sessionLabel}":\n${content}`
        : `From meeting "${sessionLabel}":\n${content}`);
      excerpts.push(...transcriptChunks.map(c => c.content.substring(0, 100) + "..."));
    }

    if (attachmentChunks.length > 0) {
      for (const chunk of attachmentChunks) {
        const fileName = chunk.sourceName || "document";
        contextParts.push(isHebrew
          ? `מקובץ "${fileName}" בפגישה "${sessionLabel}":\n${chunk.content}`
          : `From file "${fileName}" in meeting "${sessionLabel}":\n${chunk.content}`);
        excerpts.push(chunk.content.substring(0, 100) + "...");
      }
    }

    sources.push({
      sessionId,
      sessionTitle: data.title,
      sessionDate: data.date,
      excerpts,
    });
  }

  if (contextParts.length === 0) {
    return {
      answer: isHebrew
        ? "לא מצאתי מידע רלוונטי בפגישות שלך. נסה לנסח את השאלה אחרת או ודא שיש פגישות עם תמלולים."
        : "I couldn't find relevant information in your meetings. Try rephrasing your question or make sure you have meetings with transcripts.",
      sources: [],
    };
  }

  const finalContext = contextParts.join("\n\n---\n\n");

  const systemPrompt = isHebrew
    ? `אתה עוזר מועיל עם זיכרון מלא של כל הפגישות של המשתמש. בהינתן קטעים רלוונטיים ממספר פגישות, ענה על שאלות המשתמש בצורה תמציתית ומדויקת.

חשוב:
- ציין מאיזו פגישה מגיע כל מידע (שם הפגישה ותאריך אם יש)
- אם המידע מגיע ממסמך מצורף, ציין גם את שם הקובץ
- אם אתה משלב מידע ממספר פגישות, הבהר זאת
- אם המידע לא מופיע בחומר שסופק, אמור זאת בבירור
- השב בעברית`
    : `You are a helpful assistant with full memory of all the user's meetings. Given relevant excerpts from multiple meetings, answer the user's questions concisely and accurately.

Important:
- Cite which meeting each piece of information comes from (meeting name and date if available)
- If information comes from an attached document, also mention the file name
- If you're combining information from multiple meetings, make that clear
- If the information is not in the provided material, say so clearly`;

  const response = await getOpenAI().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${finalContext}\n\n${isHebrew ? "שאלה" : "Question"}: ${question}` },
    ],
    temperature: 0.3,
    max_tokens: 800,
  });

  const answer = response.choices[0]?.message?.content || (isHebrew
    ? "לא ניתן לענות על השאלה."
    : "Unable to answer the question.");

  return { answer, sources };
}

/**
 * Simple question answering without RAG (fallback)
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
