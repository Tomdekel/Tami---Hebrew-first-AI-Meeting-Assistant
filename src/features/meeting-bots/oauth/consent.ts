import type { ConsentLogEntry, OAuthProvider } from "../types";

const consentLog = new Map<string, ConsentLogEntry[]>();

/**
 * Record an OAuth consent action for auditability.
 */
export function logConsent(
  userId: string,
  provider: OAuthProvider,
  scopes: string[],
  notes?: string
): ConsentLogEntry {
  const entry: ConsentLogEntry = {
    userId,
    provider,
    scopes,
    timestamp: new Date().toISOString(),
    notes,
  };

  const existing = consentLog.get(userId) ?? [];
  existing.push(entry);
  consentLog.set(userId, existing);
  return entry;
}

/**
 * Get previously logged consent events for a user.
 */
export function getConsentLog(userId: string): ConsentLogEntry[] {
  return consentLog.get(userId) ?? [];
}
