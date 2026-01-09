/**
 * Entity Similarity Detection
 *
 * Uses a multi-layered approach (based on KYC enum normalization concept):
 * 1. Alias dictionary - Exact matches against known aliases
 * 2. Fuzzy matching - Levenshtein distance for typos/spelling variations
 * 3. Embedding similarity - Semantic matching for related names
 * 4. LLM fallback - GPT for ambiguous cases
 */

import OpenAI from "openai";
import { GraphEntity } from "@/lib/neo4j/types";
import { generateEmbedding, cosineSimilarity } from "./embeddings";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY environment variable is not set");
    }
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export type SimilarityMethod = "alias" | "fuzzy" | "semantic" | "llm";

export interface SimilarityMatch {
  entity: GraphEntity;
  score: number; // 0-1, higher = more similar
  method: SimilarityMethod;
  reason: string;
}

export interface SimilarityOptions {
  threshold?: number; // Minimum score to include (default: 0.7)
  maxResults?: number; // Maximum matches to return (default: 5)
  methods?: SimilarityMethod[]; // Which methods to use (default: all)
  skipLLM?: boolean; // Skip expensive LLM calls (default: false)
}

const DEFAULT_OPTIONS: Required<SimilarityOptions> = {
  threshold: 0.7,
  maxResults: 5,
  methods: ["alias", "fuzzy", "semantic", "llm"],
  skipLLM: false,
};

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score from Levenshtein distance
 * Returns 0-1 where 1 is exact match
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / maxLen;
}

/**
 * Check if entity matches any alias of another entity
 * Uses Set for O(n) instead of O(n²) complexity
 */
function checkAliasMatch(
  source: GraphEntity,
  candidate: GraphEntity
): SimilarityMatch | null {
  const sourceValues = new Set([
    source.normalized_value,
    source.display_value.toLowerCase(),
    ...(source.aliases || []).map((a) => a.toLowerCase()),
  ]);

  const candidateValues = [
    candidate.normalized_value,
    candidate.display_value.toLowerCase(),
    ...(candidate.aliases || []).map((a) => a.toLowerCase()),
  ];

  for (const cv of candidateValues) {
    if (sourceValues.has(cv)) {
      return {
        entity: candidate,
        score: 1.0,
        method: "alias",
        reason: `Exact alias match: "${cv}"`,
      };
    }
  }

  return null;
}

/**
 * Check fuzzy string similarity using Levenshtein distance
 */
function checkFuzzyMatch(
  source: GraphEntity,
  candidate: GraphEntity,
  threshold: number
): SimilarityMatch | null {
  const sourceNorm = source.normalized_value;
  const candidateNorm = candidate.normalized_value;

  // Skip if strings are too different in length
  const lenDiff = Math.abs(sourceNorm.length - candidateNorm.length);
  if (lenDiff > Math.max(sourceNorm.length, candidateNorm.length) * 0.5) {
    return null;
  }

  const similarity = levenshteinSimilarity(sourceNorm, candidateNorm);

  if (similarity >= threshold) {
    return {
      entity: candidate,
      score: similarity,
      method: "fuzzy",
      reason: `Fuzzy match (${Math.round(similarity * 100)}% similar)`,
    };
  }

  // Also check display values
  const displaySim = levenshteinSimilarity(
    source.display_value.toLowerCase(),
    candidate.display_value.toLowerCase()
  );

  if (displaySim >= threshold) {
    return {
      entity: candidate,
      score: displaySim,
      method: "fuzzy",
      reason: `Fuzzy match on display name (${Math.round(displaySim * 100)}% similar)`,
    };
  }

  return null;
}

/**
 * Check semantic similarity using embeddings
 */
async function checkSemanticMatch(
  source: GraphEntity,
  candidate: GraphEntity,
  threshold: number
): Promise<SimilarityMatch | null> {
  try {
    // Generate embeddings for both entity names
    const [sourceEmb, candidateEmb] = await Promise.all([
      generateEmbedding(source.display_value),
      generateEmbedding(candidate.display_value),
    ]);

    const similarity = cosineSimilarity(
      sourceEmb.embedding,
      candidateEmb.embedding
    );

    if (similarity >= threshold) {
      return {
        entity: candidate,
        score: similarity,
        method: "semantic",
        reason: `Semantic similarity (${Math.round(similarity * 100)}%)`,
      };
    }
  } catch (error) {
    console.error("Semantic matching error:", error);
  }

  return null;
}

/**
 * Use LLM to determine if two entities are duplicates
 */
async function checkLLMMatch(
  source: GraphEntity,
  candidate: GraphEntity,
  sourceType: string,
  candidateType: string
): Promise<SimilarityMatch | null> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are an expert at determining if two entity names refer to the same real-world entity.
Consider:
- Name variations (Tom/Thomas, Inc/Incorporated)
- Abbreviations and acronyms
- Common nicknames
- Typos and spelling variations
- Different representations of the same thing

Return ONLY a JSON object with:
- "isDuplicate": boolean
- "confidence": number (0-1)
- "reason": string (brief explanation)`,
        },
        {
          role: "user",
          content: `Are these two ${sourceType === candidateType ? sourceType + "s" : "entities"} the same?

Entity 1: "${source.display_value}" (type: ${sourceType})
${source.aliases?.length ? `Aliases: ${source.aliases.join(", ")}` : ""}

Entity 2: "${candidate.display_value}" (type: ${candidateType})
${candidate.aliases?.length ? `Aliases: ${candidate.aliases.join(", ")}` : ""}`,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    // Parse and validate LLM response
    let result: { isDuplicate?: unknown; confidence?: unknown; reason?: unknown };
    try {
      result = JSON.parse(content);
    } catch {
      console.error("Failed to parse LLM response as JSON:", content);
      return null;
    }

    // Validate response structure
    if (
      typeof result.isDuplicate !== "boolean" ||
      typeof result.confidence !== "number" ||
      typeof result.reason !== "string"
    ) {
      console.error("Invalid LLM response format:", result);
      return null;
    }

    if (result.isDuplicate && result.confidence >= 0.7) {
      return {
        entity: candidate,
        score: result.confidence,
        method: "llm",
        reason: result.reason,
      };
    }
  } catch (error) {
    console.error("LLM matching error:", error);
  }

  return null;
}

/**
 * Find entities similar to the given entity
 *
 * Uses cascading approach:
 * 1. Alias match (instant, exact)
 * 2. Fuzzy match (fast, string-based)
 * 3. Semantic match (medium, embedding-based)
 * 4. LLM match (slow, AI-based) - only for remaining candidates
 */
export async function findSimilarEntities(
  entity: GraphEntity,
  candidates: GraphEntity[],
  entityType: string,
  options?: SimilarityOptions
): Promise<SimilarityMatch[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const matches: SimilarityMatch[] = [];
  const checkedIds = new Set<string>([entity.id]);

  // Filter candidates to same type only (usually)
  const sameTypeCandidates = candidates.filter(
    (c) => c.id !== entity.id && !checkedIds.has(c.id)
  );

  // Phase 1: Alias matching (fast, exact)
  if (opts.methods.includes("alias")) {
    for (const candidate of sameTypeCandidates) {
      if (checkedIds.has(candidate.id)) continue;

      const match = checkAliasMatch(entity, candidate);
      if (match) {
        matches.push(match);
        checkedIds.add(candidate.id);
      }
    }
  }

  // Phase 2: Fuzzy matching (fast, string-based)
  if (opts.methods.includes("fuzzy")) {
    for (const candidate of sameTypeCandidates) {
      if (checkedIds.has(candidate.id)) continue;

      const match = checkFuzzyMatch(entity, candidate, opts.threshold);
      if (match) {
        matches.push(match);
        checkedIds.add(candidate.id);
      }
    }
  }

  // Phase 3: Semantic matching (slower, embedding-based)
  // Only check candidates that weren't matched yet
  if (opts.methods.includes("semantic")) {
    const remainingCandidates = sameTypeCandidates.filter(
      (c) => !checkedIds.has(c.id)
    );

    // Limit semantic checks to avoid too many API calls
    const semanticCandidates = remainingCandidates.slice(0, 10);

    for (const candidate of semanticCandidates) {
      const match = await checkSemanticMatch(entity, candidate, opts.threshold);
      if (match) {
        matches.push(match);
        checkedIds.add(candidate.id);
      }
    }
  }

  // Phase 4: LLM matching (slowest, AI-based)
  // Only for remaining candidates that seem somewhat similar
  if (opts.methods.includes("llm") && !opts.skipLLM) {
    const remainingCandidates = sameTypeCandidates.filter(
      (c) => !checkedIds.has(c.id)
    );

    // Pre-filter to names that share at least one word or similar length
    const llmCandidates = remainingCandidates
      .filter((c) => {
        const sourceWords = new Set(entity.display_value.toLowerCase().split(/\s+/));
        const candidateWords = c.display_value.toLowerCase().split(/\s+/);
        return candidateWords.some((w) => sourceWords.has(w));
      })
      .slice(0, 5); // Limit LLM calls

    for (const candidate of llmCandidates) {
      const candidateType =
        candidate._labels?.find((l) => l !== "Entity")?.toLowerCase() ||
        "other";
      const match = await checkLLMMatch(entity, candidate, entityType, candidateType);
      if (match) {
        matches.push(match);
        checkedIds.add(candidate.id);
      }
    }
  }

  // Sort by score descending and limit results
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, opts.maxResults);
}

/**
 * Find all duplicate groups across entities
 * Returns groups of entities that are likely duplicates
 */
export async function findDuplicateGroups(
  entities: GraphEntity[],
  options?: SimilarityOptions
): Promise<Array<{ canonical: GraphEntity; duplicates: SimilarityMatch[] }>> {
  const opts = { ...DEFAULT_OPTIONS, ...options, skipLLM: true }; // Skip LLM for batch
  const processed = new Set<string>();
  const groups: Array<{ canonical: GraphEntity; duplicates: SimilarityMatch[] }> = [];

  // Group entities by type
  const byType = new Map<string, GraphEntity[]>();
  for (const entity of entities) {
    const type = entity._labels?.find((l) => l !== "Entity")?.toLowerCase() || "other";
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(entity);
  }

  // Process each type group
  for (const [type, typeEntities] of byType) {
    // Sort by mention count (most mentioned = canonical)
    const sorted = [...typeEntities].sort(
      (a, b) => (b.mention_count || 0) - (a.mention_count || 0)
    );

    for (const entity of sorted) {
      if (processed.has(entity.id)) continue;

      const candidates = sorted.filter(
        (c) => c.id !== entity.id && !processed.has(c.id)
      );

      const matches = await findSimilarEntities(entity, candidates, type, opts);

      if (matches.length > 0) {
        groups.push({
          canonical: entity,
          duplicates: matches,
        });
        processed.add(entity.id);
        matches.forEach((m) => processed.add(m.entity.id));
      }
    }
  }

  return groups;
}

/**
 * Quick check if two specific entities are likely duplicates
 */
export async function areEntitiesDuplicates(
  entity1: GraphEntity,
  entity2: GraphEntity,
  type1: string,
  type2: string
): Promise<{ isDuplicate: boolean; confidence: number; reason: string }> {
  // Different types = not duplicates (usually)
  if (type1 !== type2) {
    return {
      isDuplicate: false,
      confidence: 1.0,
      reason: "Different entity types",
    };
  }

  // Check alias match
  const aliasMatch = checkAliasMatch(entity1, entity2);
  if (aliasMatch) {
    return {
      isDuplicate: true,
      confidence: aliasMatch.score,
      reason: aliasMatch.reason,
    };
  }

  // Check fuzzy match
  const fuzzyMatch = checkFuzzyMatch(entity1, entity2, 0.8);
  if (fuzzyMatch) {
    return {
      isDuplicate: true,
      confidence: fuzzyMatch.score,
      reason: fuzzyMatch.reason,
    };
  }

  // Check semantic match
  const semanticMatch = await checkSemanticMatch(entity1, entity2, 0.85);
  if (semanticMatch) {
    return {
      isDuplicate: true,
      confidence: semanticMatch.score,
      reason: semanticMatch.reason,
    };
  }

  // Check LLM as final step
  const llmMatch = await checkLLMMatch(entity1, entity2, type1, type2);
  if (llmMatch) {
    return {
      isDuplicate: true,
      confidence: llmMatch.score,
      reason: llmMatch.reason,
    };
  }

  return {
    isDuplicate: false,
    confidence: 0.9,
    reason: "No similarity detected",
  };
}
