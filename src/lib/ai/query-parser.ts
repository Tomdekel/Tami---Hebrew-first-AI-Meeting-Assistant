/**
 * Query Intent Parser
 *
 * Detects whether a query is a person-filter query or a semantic query.
 * Person-filter queries MUST use deterministic filtering before semantic search.
 */

export type QueryType = "person_filter" | "semantic";
export type QueryIntent = "list" | "summarize" | "answer" | "last" | "decisions" | "general";

export interface ParsedQuery {
  type: QueryType;
  personNames: string[];
  intent: QueryIntent;
  originalQuery: string;
}

// Hebrew patterns for person-filter queries
const HEBREW_PERSON_PATTERNS = [
  // "meetings with X" patterns
  /(?:הפגישות|פגישות|השיחות|שיחות|הישיבות|ישיבות)\s+(?:עם|של)\s+(.+?)(?:\s*[?.,]|$)/i,
  // "with X" at end of query
  /(?:עם|של)\s+(.+?)$/i,
  // "what did X say"
  /מה\s+(?:אמר|אמרה|דיבר|דיברה)\s+(.+?)(?:\s+על|\s+לגבי|\s*[?]|$)/i,
  // "summarize meetings with X"
  /(?:סכם|סכמי|תסכם|תסכמי)\s+(?:את\s+)?(?:הפגישות|פגישות|השיחות|שיחות)\s+(?:עם|של)\s+(.+?)(?:\s*[?.,]|$)/i,
  // "last meeting with X"
  /(?:הפגישה|פגישה|השיחה|שיחה)\s+(?:האחרונה|האחרון)\s+(?:עם|של)\s+(.+?)(?:\s*[?.,]|$)/i,
  // "what did we discuss with X"
  /(?:מה\s+)?(?:דיברנו|דיברתי|שוחחנו|דנו)\s+(?:עם|על|לגבי)\s+(.+?)(?:\s*[?.,]|$)/i,
];

// English patterns for person-filter queries
const ENGLISH_PERSON_PATTERNS = [
  // "meetings with X" patterns
  /(?:meetings?|calls?|conversations?|sessions?)\s+(?:with|involving)\s+(.+?)(?:\s*[?.,]|$)/i,
  // "with X" at end of query
  /(?:with|involving)\s+(.+?)$/i,
  // "what did X say"
  /what\s+did\s+(.+?)\s+(?:say|mention|discuss|talk\s+about)/i,
  // "summarize meetings with X"
  /summarize\s+(?:my\s+)?(?:meetings?|calls?|conversations?)\s+with\s+(.+?)(?:\s*[?.,]|$)/i,
  // "last meeting with X"
  /(?:last|latest|recent|previous)\s+(?:meeting|call|conversation)\s+with\s+(.+?)(?:\s*[?.,]|$)/i,
  // "what did we discuss with X"
  /what\s+(?:did\s+)?(?:we|I)\s+(?:discuss|talk\s+about|decide)\s+with\s+(.+?)(?:\s*[?.,]|$)/i,
];

// Intent detection patterns
const INTENT_PATTERNS: { pattern: RegExp; intent: QueryIntent }[] = [
  // List/show patterns
  { pattern: /(?:הצג|הראה|רשום|list|show|all)/i, intent: "list" },
  // Summarize patterns
  { pattern: /(?:סכם|תסכם|סיכום|summarize|summary)/i, intent: "summarize" },
  // Last/recent patterns
  { pattern: /(?:אחרונה?|האחרונה?|last|latest|recent|previous)/i, intent: "last" },
  // Decisions patterns
  { pattern: /(?:החלטות|הוחלט|decisions?|decided)/i, intent: "decisions" },
];

// Common words that are NOT person names
const STOPWORDS = new Set([
  // Hebrew
  "את", "על", "עם", "של", "לגבי", "בנושא", "זה", "זאת", "הזה", "הזאת",
  "אני", "אנחנו", "הם", "היא", "הוא", "מה", "איך", "למה", "מתי", "איפה",
  "כל", "הכל", "שלי", "שלנו", "שלהם", "שלו", "שלה",
  // English
  "the", "a", "an", "my", "our", "their", "this", "that", "all", "any",
  "what", "how", "why", "when", "where", "which", "who",
  "i", "we", "they", "he", "she", "it", "me", "us", "them",
]);

/**
 * Extract person names from a query
 */
function extractPersonNames(query: string): string[] {
  const names: string[] = [];
  const patterns = [...HEBREW_PERSON_PATTERNS, ...ENGLISH_PERSON_PATTERNS];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match && match[1]) {
      const potentialName = match[1].trim();
      // Filter out stopwords and short strings
      if (potentialName.length > 1 && !STOPWORDS.has(potentialName.toLowerCase())) {
        // Clean up the name - remove trailing punctuation
        const cleanName = potentialName.replace(/[?.,!]+$/, "").trim();
        if (cleanName && !names.includes(cleanName)) {
          names.push(cleanName);
        }
      }
    }
  }

  return names;
}

/**
 * Detect query intent (list, summarize, answer, etc.)
 */
function detectIntent(query: string): QueryIntent {
  for (const { pattern, intent } of INTENT_PATTERNS) {
    if (pattern.test(query)) {
      return intent;
    }
  }
  return "general";
}

/**
 * Parse a user query to determine type and extract metadata
 */
export function parseQueryIntent(query: string): ParsedQuery {
  const trimmedQuery = query.trim();
  const personNames = extractPersonNames(trimmedQuery);
  const intent = detectIntent(trimmedQuery);

  // If we found person names, this is a person-filter query
  if (personNames.length > 0) {
    return {
      type: "person_filter",
      personNames,
      intent,
      originalQuery: trimmedQuery,
    };
  }

  // Otherwise, it's a semantic query
  return {
    type: "semantic",
    personNames: [],
    intent,
    originalQuery: trimmedQuery,
  };
}

/**
 * Check if a query is explicitly asking about a person
 */
export function isPersonQuery(query: string): boolean {
  const parsed = parseQueryIntent(query);
  return parsed.type === "person_filter";
}

export function isQuestionQuery(query: string): boolean {
  const trimmed = query.trim();
  if (!trimmed) return false;
  if (trimmed.includes("?")) return true;

  const questionStarters = [
    /^(what|why|how|when|where|who|which)\b/i,
    /^(did|do|does|can|could|should|would|is|are|was|were)\b/i,
    /^(מה|למה|איך|מתי|איפה|מי|איזה|האם)\b/i,
  ];

  return questionStarters.some((pattern) => pattern.test(trimmed));
}
