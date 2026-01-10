import type { CalendarEvent, MeetingSelection, MeetingSelectionRule } from "../types";

function includesAny(text: string, keywords?: string[]): boolean {
  if (!keywords || keywords.length === 0) {
    return true;
  }
  return keywords.some((keyword) => text.includes(keyword));
}

function excludesAny(text: string, keywords?: string[]): boolean {
  if (!keywords || keywords.length === 0) {
    return true;
  }
  return !keywords.some((keyword) => text.includes(keyword));
}

function matchesParticipants(event: CalendarEvent, participants?: string[]): boolean {
  if (!participants || participants.length === 0) {
    return true;
  }
  const attendeeEmails = new Set(event.attendees?.map((attendee) => attendee.email.toLowerCase()) ?? []);
  return participants.every((participant) => attendeeEmails.has(participant.toLowerCase()));
}

function matchesTags(event: CalendarEvent, tags?: string[]): boolean {
  if (!tags || tags.length === 0) {
    return true;
  }
  const eventTags = new Set(event.tags ?? []);
  return tags.every((tag) => eventTags.has(tag));
}

/**
 * Apply rule-based filtering to calendar events.
 */
export function applySelectionRules(
  events: CalendarEvent[],
  rules: MeetingSelectionRule[]
): CalendarEvent[] {
  return events.filter((event) => {
    return rules.every((rule) => {
      const title = event.title ?? "";
      const matchesTitle = includesAny(title, rule.includeTitleKeywords);
      const excludesTitle = excludesAny(title, rule.excludeTitleKeywords);
      const matchesPeople = matchesParticipants(event, rule.requiredParticipants);
      const matchesTagsRule = matchesTags(event, rule.tags);
      const matchesPlatform = rule.platform ? rule.platform.includes(event.platform) : true;
      const matchesRegex = rule.titleRegex
        ? new RegExp(rule.titleRegex, "i").test(title)
        : true;

      return (
        matchesTitle &&
        excludesTitle &&
        matchesPeople &&
        matchesTagsRule &&
        matchesPlatform &&
        matchesRegex
      );
    });
  });
}

/**
 * Create a meeting selection payload from rules.
 */
export function createMeetingSelection(
  userId: string,
  events: CalendarEvent[],
  rules: MeetingSelectionRule[],
  mode?: MeetingSelectionRule["mode"]
): MeetingSelection {
  const selected = applySelectionRules(events, rules);
  return {
    id: `sel_${Math.random().toString(36).slice(2)}`,
    userId,
    createdAt: new Date().toISOString(),
    ruleIds: rules.map((rule) => rule.id),
    eventIds: selected.map((event) => event.id),
    mode,
  };
}
