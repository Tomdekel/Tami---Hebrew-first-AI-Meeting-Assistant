import { useMemo } from "react";
import type { CalendarEvent, MeetingSelectionRule } from "../types";
import { applySelectionRules } from "../selection/filters";

/**
 * React hook to compute rule-based meeting selections.
 */
export function useMeetingBotSelection(
  events: CalendarEvent[],
  rules: MeetingSelectionRule[]
): CalendarEvent[] {
  return useMemo(() => applySelectionRules(events, rules), [events, rules]);
}
