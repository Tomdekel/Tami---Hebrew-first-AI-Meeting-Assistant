import type {
  BotAdapter,
  BotJoinRequest,
  BotJoinResult,
  BotMode,
  CalendarEvent,
  MeetingBotSchedulerJob,
  MeetingPlatform,
  MeetingSelection,
  MeetingSelectionRule,
} from "./types";
import { MeetingBotError } from "./errors";
import { applySelectionRules, createMeetingSelection } from "./selection/filters";
import { detectMeetingPlatform } from "./selection/platform";
import { getEvents, saveEvents, saveSelection } from "./storage/inMemoryStore";
import { joinNow, scheduleBotJoin } from "./scheduler/scheduler";

export interface MeetingBotServiceConfig {
  adapters: Partial<Record<MeetingPlatform, BotAdapter>>;
  defaultMode?: BotMode;
}

/**
 * Create a meeting bot service for selection and join flows.
 */
export function createMeetingBotService(config: MeetingBotServiceConfig) {
  const defaultMode: BotMode = config.defaultMode ?? "visible";

  function resolveAdapter(platform: MeetingPlatform): BotAdapter {
    const adapter = config.adapters[platform];
    if (!adapter) {
      throw new MeetingBotError("BOT_ADAPTER_MISSING", `No bot adapter configured for ${platform}.`);
    }
    return adapter;
  }

  return {
    /**
     * Store calendar events in-memory for a user.
     */
    storeEvents(userId: string, events: CalendarEvent[]): void {
      saveEvents(userId, events);
    },

    /**
     * Read calendar events from in-memory storage for a user.
     */
    getEvents(userId: string): CalendarEvent[] {
      return getEvents(userId);
    },

    /**
     * Detect meeting platform based on meeting URL.
     */
    detectPlatform(meetingUrl?: string): MeetingPlatform {
      return detectMeetingPlatform(meetingUrl);
    },

    /**
     * Apply rule filters to events and return the matching subset.
     */
    filterEvents(events: CalendarEvent[], rules: MeetingSelectionRule[]): CalendarEvent[] {
      return applySelectionRules(events, rules);
    },

    /**
     * Create and save a rule-based meeting selection for a user.
     */
    createSelection(
      userId: string,
      events: CalendarEvent[],
      rules: MeetingSelectionRule[],
      mode: BotMode = defaultMode
    ): MeetingSelection {
      const selection = createMeetingSelection(userId, events, rules, mode);
      saveSelection(userId, selection);
      return selection;
    },

    /**
     * Schedule a bot to join a meeting at the requested time.
     */
    scheduleJoin(request: BotJoinRequest): MeetingBotSchedulerJob {
      const adapter = resolveAdapter(request.event.platform);
      return scheduleBotJoin(adapter, request);
    },

    /**
     * Join a meeting immediately and return the join result.
     */
    async joinMeeting(request: BotJoinRequest): Promise<BotJoinResult> {
      const adapter = resolveAdapter(request.event.platform);
      return joinNow(adapter, request);
    },
  };
}
