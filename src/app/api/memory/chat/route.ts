import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { parseQueryIntent, isQuestionQuery } from "@/lib/ai/query-parser";
import { generateAiAnswerFromEvidence, type EvidenceQuote } from "@/lib/ai/evidence-answer";
import { buildIlikeFilter, extractKeywords, formatTimestamp } from "@/lib/search/keyword";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { searchEmbeddings } from "@/lib/search/vector";
import { SupabaseClient } from "@supabase/supabase-js";

const MAX_EXACT_MENTIONS = 40;
const MAX_KEYWORDS = 6;

interface ExactMention {
  quoteId: string;
  text: string;
  speaker?: string | null;
  meetingId: string;
  meetingTitle: string;
  meetingDate?: string;
  tStart?: number | null;
  tEnd?: number | null;
  segmentId?: string | null;
  sourceType: "meeting" | "doc" | "summary";
  docId?: string | null;
  page?: number | null;
  chunkId?: string | null;
  summaryField?: string | null;
  deepLink: string;
}

function toSources(mentions: ExactMention[]) {
  return mentions.map((mention) => ({
    sessionId: mention.meetingId,
    sessionTitle: mention.meetingTitle,
    sessionDate: mention.meetingDate,
    excerpts: [mention.text],
    speaker: mention.speaker || undefined,
    timestamp: mention.tStart !== null && mention.tStart !== undefined ? formatTimestamp(mention.tStart) : undefined,
    deepLink: mention.deepLink,
  }));
}

async function getOrCreateDefaultChat(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: existing } = await supabase
    .from("memory_chats")
    .select("id")
    .eq("user_id", userId)
    .eq("is_default", true)
    .single();

  if (existing?.id) return existing.id;

  const { data: created, error } = await supabase
    .from("memory_chats")
    .insert({
      user_id: userId,
      title: "Memory",
      is_default: true,
      last_message_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !created?.id) {
    throw new Error("Failed to create memory chat");
  }

  return created.id;
}

async function resolveChatId(
  supabase: SupabaseClient,
  userId: string,
  chatId?: string | null
): Promise<string> {
  if (!chatId) {
    return getOrCreateDefaultChat(supabase, userId);
  }

  const { data: chat } = await supabase
    .from("memory_chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", userId)
    .single();

  if (!chat?.id) {
    throw new Error("Chat not found");
  }

  return chat.id;
}

async function resolvePersonIds(
  supabase: SupabaseClient,
  userId: string,
  personNames: string[]
): Promise<{ personIds: string[]; resolvedNames: Map<string, string> }> {
  const personIds: string[] = [];
  const resolvedNames = new Map<string, string>();

  for (const name of personNames) {
    const normalizedKey = name.toLowerCase().trim();
    if (!normalizedKey || normalizedKey.length > 100) continue;

    const { data: exactMatch } = await supabase
      .from("people")
      .select("id, display_name")
      .eq("user_id", userId)
      .eq("normalized_key", normalizedKey)
      .single();

    if (exactMatch) {
      personIds.push(exactMatch.id);
      resolvedNames.set(name, exactMatch.display_name);
      continue;
    }

    const { data: partialMatches } = await supabase
      .from("people")
      .select("id, display_name")
      .eq("user_id", userId)
      .ilike("display_name", `%${normalizedKey}%`)
      .limit(1);

    if (partialMatches && partialMatches.length > 0) {
      personIds.push(partialMatches[0].id);
      resolvedNames.set(name, partialMatches[0].display_name);
      continue;
    }

    const { data: aliasMatches } = await supabase
      .from("people")
      .select("id, display_name, aliases")
      .eq("user_id", userId);

    if (aliasMatches) {
      for (const person of aliasMatches) {
        const aliases = person.aliases || [];
        if (aliases.some((alias: string) => alias.toLowerCase().includes(normalizedKey))) {
          personIds.push(person.id);
          resolvedNames.set(name, person.display_name);
          break;
        }
      }
    }
  }

  return { personIds, resolvedNames };
}

async function getSessionsForPeople(
  supabase: SupabaseClient,
  personIds: string[]
): Promise<string[]> {
  if (personIds.length === 0) return [];

  const { data } = await supabase
    .from("session_people")
    .select("session_id")
    .in("person_id", personIds);

  return [...new Set((data || []).map((sp) => sp.session_id))];
}

async function fetchSessionMetadata(supabase: SupabaseClient, sessionIds: string[]) {
  if (sessionIds.length === 0) return new Map<string, { title: string; created_at: string }>();

  const { data: sessions } = await supabase
    .from("sessions")
    .select("id, title, created_at")
    .in("id", sessionIds);

  const sessionsMap = new Map<string, { title: string; created_at: string }>();
  for (const session of sessions || []) {
    sessionsMap.set(session.id, {
      title: session.title || "Untitled Meeting",
      created_at: session.created_at,
    });
  }
  return sessionsMap;
}

async function collectTranscriptMentions(
  supabase: SupabaseClient,
  sessionIds: string[],
  keywords: string[],
  sessionsMap: Map<string, { title: string; created_at: string }>,
  language: "en" | "he"
): Promise<ExactMention[]> {
  if (sessionIds.length === 0 || keywords.length === 0) return [];

  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("id, session_id")
    .in("session_id", sessionIds);

  const transcriptIds = (transcripts || []).map((t) => t.id);
  const transcriptToSession = new Map<string, string>();
  for (const transcript of transcripts || []) {
    transcriptToSession.set(transcript.id, transcript.session_id);
  }

  if (transcriptIds.length === 0) return [];

  const { data: segments } = await supabase
    .from("transcript_segments")
    .select("id, transcript_id, speaker_name, speaker_id, text, start_time, end_time")
    .in("transcript_id", transcriptIds)
    .or(buildIlikeFilter("text", keywords))
    .limit(MAX_EXACT_MENTIONS * 2);

  const mentions: ExactMention[] = [];
  const seen = new Set<string>();

  for (const segment of segments || []) {
    const sessionId = transcriptToSession.get(segment.transcript_id);
    if (!sessionId) continue;
    const session = sessionsMap.get(sessionId);
    if (!session) continue;

    const quoteId = `seg_${segment.id}`;
    if (seen.has(quoteId)) continue;
    seen.add(quoteId);

    const meetingDate = session.created_at
      ? new Date(session.created_at).toLocaleDateString(language === "he" ? "he-IL" : "en-US")
      : undefined;

    const tStart = segment.start_time ?? null;
    const deepLink = `/meetings/${sessionId}?t=${Math.floor(tStart || 0)}&seg=${segment.id}`;

    mentions.push({
      quoteId,
      text: segment.text,
      speaker: segment.speaker_name || segment.speaker_id,
      meetingId: sessionId,
      meetingTitle: session.title,
      meetingDate,
      tStart,
      tEnd: segment.end_time ?? null,
      segmentId: segment.id,
      sourceType: "meeting",
      deepLink,
    });

    if (mentions.length >= MAX_EXACT_MENTIONS) break;
  }

  return mentions;
}

async function collectAttachmentMentions(
  supabase: SupabaseClient,
  userId: string,
  sessionIds: string[],
  keywords: string[],
  sessionsMap: Map<string, { title: string; created_at: string }>,
  language: "en" | "he"
): Promise<ExactMention[]> {
  if (sessionIds.length === 0 || keywords.length === 0) return [];

  const { data: chunks } = await supabase
    .from("attachment_chunks")
    .select("id, attachment_id, session_id, chunk_index, content, page_number, sheet_name, attachments!inner(name)")
    .eq("user_id", userId)
    .in("session_id", sessionIds)
    .or(buildIlikeFilter("content", keywords))
    .limit(MAX_EXACT_MENTIONS * 2);

  const mentions: ExactMention[] = [];
  const seen = new Set<string>();

  for (const chunk of chunks || []) {
    const session = sessionsMap.get(chunk.session_id);
    if (!session) continue;

    const chunkId = chunk.id as string;
    if (seen.has(chunkId)) continue;
    seen.add(chunkId);

    const meetingDate = session.created_at
      ? new Date(session.created_at).toLocaleDateString(language === "he" ? "he-IL" : "en-US")
      : undefined;

    const deepLink = `/meetings/${chunk.session_id}?doc=${chunk.attachment_id}&chunkId=${chunkId}`;

    mentions.push({
      quoteId: `doc_${chunkId}`,
      text: chunk.content,
      meetingId: chunk.session_id,
      meetingTitle: session.title,
      meetingDate,
      sourceType: "doc",
      docId: chunk.attachment_id,
      page: chunk.page_number ?? null,
      chunkId,
      deepLink,
    });

    if (mentions.length >= MAX_EXACT_MENTIONS) break;
  }

  return mentions;
}

async function collectSummaryMentions(
  supabase: SupabaseClient,
  sessionIds: string[],
  keywords: string[],
  sessionsMap: Map<string, { title: string; created_at: string }>,
  language: "en" | "he"
): Promise<ExactMention[]> {
  if (sessionIds.length === 0 || keywords.length === 0) return [];

  // Build OR filter for each keyword across all summary fields
  const keywordFilters = keywords.map((k) => {
    const escaped = k.replace(/[%_]/g, '\\$&');
    return `overview.ilike.%${escaped}%,key_points.ilike.%${escaped}%,decisions.ilike.%${escaped}%,notes.ilike.%${escaped}%`;
  });

  const { data: summaries } = await supabase
    .from("summaries")
    .select("id, session_id, overview, key_points, decisions, notes")
    .in("session_id", sessionIds)
    .or(keywordFilters.join(","))
    .limit(MAX_EXACT_MENTIONS);

  const mentions: ExactMention[] = [];
  const seen = new Set<string>();

  for (const summary of summaries || []) {
    const session = sessionsMap.get(summary.session_id);
    if (!session) continue;

    const meetingDate = session.created_at
      ? new Date(session.created_at).toLocaleDateString(language === "he" ? "he-IL" : "en-US")
      : undefined;

    // Check each field for keyword matches and add as separate mentions
    const fields: { name: string; content: string | null }[] = [
      { name: "overview", content: summary.overview },
      { name: "key_points", content: summary.key_points },
      { name: "decisions", content: summary.decisions },
      { name: "notes", content: summary.notes },
    ];

    for (const field of fields) {
      if (!field.content) continue;

      // Check if any keyword matches this field
      const hasMatch = keywords.some((k) =>
        field.content!.toLowerCase().includes(k.toLowerCase())
      );

      if (!hasMatch) continue;

      const quoteId = `sum_${summary.id}_${field.name}`;
      if (seen.has(quoteId)) continue;
      seen.add(quoteId);

      const deepLink = `/meetings/${summary.session_id}`;

      mentions.push({
        quoteId,
        text: field.content,
        meetingId: summary.session_id,
        meetingTitle: session.title,
        meetingDate,
        sourceType: "summary",
        summaryField: field.name,
        deepLink,
      });

      if (mentions.length >= MAX_EXACT_MENTIONS) break;
    }

    if (mentions.length >= MAX_EXACT_MENTIONS) break;
  }

  return mentions;
}

// POST /api/memory/chat - Ask a question across all meetings
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { question, chatId: requestedChatId } = body;
  const language = body.language === "he" ? "he" : "en";

  if (!question || typeof question !== "string") {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  if (question.length > 5000) {
    return NextResponse.json({ error: "Question must be under 5000 characters" }, { status: 400 });
  }

  try {
    const parsedQuery = parseQueryIntent(question);
    const keywords = extractKeywords(question, MAX_KEYWORDS);
    const wantsAnswer = isQuestionQuery(question);

    let sessionIds: string[] = [];
    let resolvedPersonNames: string[] = [];

    if (parsedQuery.type === "person_filter" && parsedQuery.personNames.length > 0) {
      const { personIds, resolvedNames } = await resolvePersonIds(
        supabase,
        user.id,
        parsedQuery.personNames
      );

      resolvedPersonNames = Array.from(resolvedNames.values());

      if (personIds.length === 0) {
        const notFoundMessage = language === "he"
          ? `לא מצאתי אדם בשם "${parsedQuery.personNames.join(", ")}" בפגישות שלך. נסה לבדוק את האיות או להשתמש בשם אחר.`
          : `I couldn't find a person named "${parsedQuery.personNames.join(", ")}" in your meetings. Try checking the spelling or using a different name.`;

        return NextResponse.json({
          answer: notFoundMessage,
          exactMentions: [],
          aiAnswer: null,
          sources: [],
          totalChunksFound: 0,
          queryType: "person_filter",
          personNotFound: true,
        });
      }

      sessionIds = await getSessionsForPeople(supabase, personIds);

      if (sessionIds.length === 0) {
        const noSessionsMessage = language === "he"
          ? `לא מצאתי פגישות עם ${resolvedPersonNames.join(", ")}. ייתכן שעדיין לא שייכת דוברים לאנשים בפגישות שלך.`
          : `I couldn't find any meetings with ${resolvedPersonNames.join(", ")}. You may need to assign speakers to people in your meetings first.`;

        return NextResponse.json({
          answer: noSessionsMessage,
          exactMentions: [],
          aiAnswer: null,
          sources: [],
          totalChunksFound: 0,
          queryType: "person_filter",
          noSessions: true,
        });
      }
    } else {
      const { data: sessions } = await supabase
        .from("sessions")
        .select("id")
        .eq("user_id", user.id);

      sessionIds = (sessions || []).map((s) => s.id);
    }

    const sessionsMap = await fetchSessionMetadata(supabase, sessionIds);
    const transcriptMentions = await collectTranscriptMentions(
      supabase,
      sessionIds,
      keywords,
      sessionsMap,
      language
    );
    const attachmentMentions = await collectAttachmentMentions(
      supabase,
      user.id,
      sessionIds,
      keywords,
      sessionsMap,
      language
    );
    const summaryMentions = await collectSummaryMentions(
      supabase,
      sessionIds,
      keywords,
      sessionsMap,
      language
    );

    // --- Vector Search ---
    let vectorMentions: ExactMention[] = [];
    try {
      const { embedding } = await generateEmbedding(question);
      const vectorResults = await searchEmbeddings(supabase, embedding, {
        match_threshold: 0.4, // Slightly lower threshold for semantic recall
        match_count: 20,
        session_id: null, // Global search (filtered by user_id in RPC)
      });

      // Filter vector results to only include allowed sessions
      const allowedVectorResults = vectorResults.filter(r => sessionIds.includes(r.session_id));

      for (const res of allowedVectorResults) {
        const session = sessionsMap.get(res.session_id);
        if (!session) continue;

        const meetingDate = session.created_at
          ? new Date(session.created_at).toLocaleDateString(language === "he" ? "he-IL" : "en-US")
          : undefined;

        const metadata = res.metadata || {};
        // Determine source type and deep link
        let sourceType: "meeting" | "doc" | "summary" = "meeting";
        let deepLink = `/meetings/${res.session_id}`;
        let quoteId = `vec_${res.id}`;
        let additionalProps: any = {};

        if (metadata.source_type === "summary") {
          sourceType = "summary";
          quoteId = `vec_sum_${metadata.summary_id}_${metadata.summary_field}`;
          additionalProps = { summaryField: metadata.summary_field };
        } else if (metadata.segmentIds && metadata.segmentIds.length > 0) {
          // It's a transcript chunk
          const firstSegId = metadata.segmentIds[0];
          const tStart = metadata.startTime;
          deepLink = `/meetings/${res.session_id}?t=${Math.floor(tStart || 0)}&seg=${firstSegId}`;
          quoteId = `vec_seg_${firstSegId}`; // Attempt to match ID format if possible, but safely unique
          additionalProps = {
            speaker: metadata.speakerName,
            tStart: metadata.startTime,
            segmentId: firstSegId
          };
        }

        vectorMentions.push({
          quoteId,
          text: res.content, // Chunk content might be larger than segment, but good for context
          meetingId: res.session_id,
          meetingTitle: session.title,
          meetingDate,
          sourceType,
          deepLink,
          ...additionalProps
        });
      }
    } catch (err) {
      console.warn("Vector search failed, proceeding with keywords only:", err);
    }

    // specific deduplication logic
    const seenQuotes = new Set<string>();
    const allMentions = [...summaryMentions, ...transcriptMentions, ...attachmentMentions, ...vectorMentions];
    const uniqueMentions: ExactMention[] = [];

    for (const m of allMentions) {
      // Create a unique key based on content and session to dedupe exact semantic duplicates
      // Or use quoteId if robust.
      // Vector chunks might overlap with exact segments.
      // If we have a vector match that covers the same time range as a transcript match, we might prefer one.
      // For now, simple ID-based dedupe + content overlap check could be complex.
      // Let's stick to ID if possible, but vector IDs are different.
      // We'll use a rough content+session key.
      const key = `${m.meetingId}_${m.text.substring(0, 50)}`;
      if (seenQuotes.has(key)) continue;
      seenQuotes.add(key);
      uniqueMentions.push(m);
    }

    // Prioritize summaries first (most concise), then remaining
    const exactMentions = uniqueMentions.slice(0, MAX_EXACT_MENTIONS);
    const evidence: EvidenceQuote[] = exactMentions.map((mention) => ({
      quoteId: mention.quoteId,
      text: mention.text,
      speaker: mention.speaker,
      meetingId: mention.meetingId,
      meetingTitle: mention.meetingTitle,
      tStart: mention.tStart,
      tEnd: mention.tEnd,
      segmentId: mention.segmentId,
      sourceType: mention.sourceType === "summary" ? "summary" : mention.sourceType === "meeting" ? "meeting" : "doc",
      docId: mention.docId,
      chunkId: mention.chunkId,
    }));

    const aiAnswer = wantsAnswer
      ? await generateAiAnswerFromEvidence(question, evidence, language)
      : null;

    const fallbackAnswer = exactMentions.length > 0
      ? (language === "he" ? "נמצאו אזכורים מדויקים." : "Exact mentions found.")
      : (language === "he" ? "..." : "...");

    const answer = aiAnswer?.paragraphs.map((p) => p.text).join("\n\n") || fallbackAnswer;
    const sources = toSources(exactMentions);

    const chatId = await resolveChatId(supabase, user.id, requestedChatId);

    await supabase.from("memory_messages").insert([
      {
        chat_id: chatId,
        role: "user",
        content: question,
      },
      {
        chat_id: chatId,
        role: "assistant",
        content: answer,
        evidence_json: {
          exactMentions,
          aiAnswer,
        },
      },
    ]);

    // Update last_message_at and auto-name chat if it's still "New Chat"
    const { data: chat } = await supabase
      .from("memory_chats")
      .select("title")
      .eq("id", chatId)
      .single();

    const isDefaultTitle = chat?.title === "שיחה חדשה" || chat?.title === "New Chat" || chat?.title === "Memory";
    const newTitle = isDefaultTitle ? question.slice(0, 50).trim() + (question.length > 50 ? "..." : "") : undefined;

    await supabase
      .from("memory_chats")
      .update({
        last_message_at: new Date().toISOString(),
        ...(newTitle && { title: newTitle }),
      })
      .eq("id", chatId);

    return NextResponse.json({
      answer,
      exactMentions,
      aiAnswer,
      sources,
      totalChunksFound: exactMentions.length,
      queryType: parsedQuery.type,
      personNames: resolvedPersonNames.length > 0 ? resolvedPersonNames : undefined,
    });
  } catch (error) {
    console.error("Global chat failed:", error);
    if (error instanceof Error && error.message === "Chat not found") {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to answer question" },
      { status: 500 }
    );
  }
}

// GET /api/memory/chat - Get global chat history
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "50", 10));
  const requestedChatId = searchParams.get("chatId");

  try {
    const chatId = await resolveChatId(supabase, user.id, requestedChatId);

    const { data: messages, error } = await supabase
      .from("memory_messages")
      .select("id, role, content, evidence_json, created_at")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    const normalized = (messages || []).map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      evidence_json: message.evidence_json || null,
      sources: message.evidence_json?.exactMentions ? toSources(message.evidence_json.exactMentions) : [],
      created_at: message.created_at,
    }));

    return NextResponse.json({
      messages: normalized,
      total: normalized.length,
    });
  } catch (error) {
    console.error("Failed to get chat history:", error);
    if (error instanceof Error && error.message === "Chat not found") {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to get chat history" },
      { status: 500 }
    );
  }
}

// DELETE /api/memory/chat - Clear chat history
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const requestedChatId = searchParams.get("chatId");

  try {
    const chatId = await resolveChatId(supabase, user.id, requestedChatId);

    const { error } = await supabase
      .from("memory_messages")
      .delete()
      .eq("chat_id", chatId);

    if (error) {
      throw error;
    }

    await supabase
      .from("memory_chats")
      .update({ last_message_at: null })
      .eq("id", chatId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to clear chat history:", error);
    if (error instanceof Error && error.message === "Chat not found") {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to clear chat history" },
      { status: 500 }
    );
  }
}
