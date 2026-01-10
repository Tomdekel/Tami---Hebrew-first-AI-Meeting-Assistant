import type { CalendarEvent, MeetingSelection, OAuthProvider, OAuthTokens } from "../types";

interface UserScopedStore {
  events: CalendarEvent[];
  selections: MeetingSelection[];
  oauthTokens: Map<OAuthProvider, OAuthTokens>;
}

const store = new Map<string, UserScopedStore>();

function getOrCreateUserStore(userId: string): UserScopedStore {
  const existing = store.get(userId);
  if (existing) {
    return existing;
  }
  const created: UserScopedStore = {
    events: [],
    selections: [],
    oauthTokens: new Map(),
  };
  store.set(userId, created);
  return created;
}

/**
 * Save calendar events in temporary in-memory storage.
 */
export function saveEvents(userId: string, events: CalendarEvent[]): void {
  const userStore = getOrCreateUserStore(userId);
  userStore.events = [...events];
}

/**
 * Read calendar events from temporary in-memory storage.
 */
export function getEvents(userId: string): CalendarEvent[] {
  return [...getOrCreateUserStore(userId).events];
}

/**
 * Save meeting selections in temporary in-memory storage.
 */
export function saveSelection(userId: string, selection: MeetingSelection): void {
  const userStore = getOrCreateUserStore(userId);
  userStore.selections = [selection, ...userStore.selections.filter((item) => item.id !== selection.id)];
}

/**
 * Read meeting selections from temporary in-memory storage.
 */
export function getSelections(userId: string): MeetingSelection[] {
  return [...getOrCreateUserStore(userId).selections];
}

/**
 * Save OAuth tokens in temporary in-memory storage.
 */
export function saveOAuthTokens(userId: string, provider: OAuthProvider, tokens: OAuthTokens): void {
  const userStore = getOrCreateUserStore(userId);
  userStore.oauthTokens.set(provider, tokens);
}

/**
 * Read OAuth tokens from temporary in-memory storage.
 */
export function getOAuthTokens(userId: string, provider: OAuthProvider): OAuthTokens | undefined {
  return getOrCreateUserStore(userId).oauthTokens.get(provider);
}

/**
 * Clear in-memory data for a user.
 */
export function clearUserStore(userId: string): void {
  store.delete(userId);
}
