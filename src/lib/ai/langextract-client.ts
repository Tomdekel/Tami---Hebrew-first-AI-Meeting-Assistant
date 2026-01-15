/**
 * LangExtract Service Client
 *
 * TypeScript client for the LangExtract entity extraction service.
 * Provides source-grounded entity extraction with confidence scores.
 */

const LANGEXTRACT_URL =
  process.env.LANGEXTRACT_SERVICE_URL || "http://localhost:8080";
const LANGEXTRACT_API_KEY = process.env.LANGEXTRACT_API_KEY || "";
const LANGEXTRACT_TIMEOUT = 30000; // 30 seconds

/**
 * Entity types supported by the extraction service.
 */
export type EntityType =
  | "person"
  | "organization"
  | "project"
  | "topic"
  | "location"
  | "date"
  | "product"
  | "technology";

/**
 * Grounded entity with source location information.
 */
export interface GroundedEntity {
  type: EntityType;
  value: string;
  normalized_value: string;
  confidence: number;
  start_offset: number;
  end_offset: number;
  source_text: string;
}

/**
 * Response from the extraction service.
 */
export interface ExtractionResult {
  entities: GroundedEntity[];
  total_extracted: number;
  language: string;
}

/**
 * Extract entities from transcript text using LangExtract service.
 *
 * @param transcript - The transcript text to extract entities from
 * @param language - Language code ("en" or "he")
 * @returns Extraction result with grounded entities
 * @throws Error if the service is unavailable or returns an error
 */
export async function extractEntitiesWithGrounding(
  transcript: string,
  language: string = "en"
): Promise<ExtractionResult> {
  if (!transcript?.trim()) {
    return {
      entities: [],
      total_extracted: 0,
      language,
    };
  }

  // Set up timeout with AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LANGEXTRACT_TIMEOUT);

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    // Include API key if configured
    if (LANGEXTRACT_API_KEY) {
      headers["X-API-Key"] = LANGEXTRACT_API_KEY;
    }

    const response = await fetch(`${LANGEXTRACT_URL}/extract`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        transcript,
        language,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `LangExtract service error (${response.status}): ${errorText}`
      );
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("LangExtract service timeout after 30 seconds");
    }
    throw error;
  }
}

/**
 * Check if the LangExtract service is healthy.
 *
 * @returns true if the service is responding, false otherwise
 */
export async function checkLangExtractHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${LANGEXTRACT_URL}/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Legacy interface for compatibility with existing code.
 * Maps GroundedEntity to the old ExtractedEntity format.
 */
export interface ExtractedEntity {
  type: EntityType;
  value: string;
  normalizedValue: string;
  mentions: number;
  context: string;
}

/**
 * Convert grounded entities to legacy format for backward compatibility.
 *
 * @param grounded - Array of grounded entities from LangExtract
 * @returns Array of legacy ExtractedEntity format
 */
export function toLegacyFormat(grounded: GroundedEntity[]): ExtractedEntity[] {
  // Group by normalized value to count mentions
  const grouped = new Map<
    string,
    { entity: GroundedEntity; count: number; contexts: string[] }
  >();

  for (const entity of grounded) {
    const key = `${entity.type}:${entity.normalized_value}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count++;
      existing.contexts.push(entity.source_text);
    } else {
      grouped.set(key, {
        entity,
        count: 1,
        contexts: [entity.source_text],
      });
    }
  }

  return Array.from(grouped.values()).map(({ entity, count, contexts }) => ({
    type: entity.type,
    value: entity.value,
    normalizedValue: entity.normalized_value,
    mentions: count,
    context: contexts[0] || "", // Use first context
  }));
}
