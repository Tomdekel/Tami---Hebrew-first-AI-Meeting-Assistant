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

function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, (char) => `\\${char}`);
}

export function extractKeywords(query: string, limit: number = 6): string[] {
  const cleaned = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return [];

  const keywords: string[] = [];
  for (const token of cleaned.split(" ")) {
    if (token.length < 2) continue;
    if (STOPWORDS.has(token)) continue;
    if (!keywords.includes(token)) {
      keywords.push(token);
    }
    if (keywords.length >= limit) break;
  }

  return keywords;
}

export function buildIlikeFilter(field: string, keywords: string[]): string {
  return keywords
    .map((keyword) => `${field}.ilike.%${escapeLikePattern(keyword)}%`)
    .join(",");
}

export function formatTimestamp(seconds: number): string {
  if (!Number.isFinite(seconds)) return "";
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
