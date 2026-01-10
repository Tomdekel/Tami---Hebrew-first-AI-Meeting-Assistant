import type { BotAdapter, BotJoinRequest, BotJoinResult, MeetingBotSchedulerJob } from "../types";

/**
 * Schedule a bot join at a specific time.
 */
export function scheduleBotJoin(
  adapter: BotAdapter,
  request: BotJoinRequest
): MeetingBotSchedulerJob {
  const joinAtMs = new Date(request.joinAt).getTime();
  const delay = Math.max(joinAtMs - Date.now(), 0);
  const timeoutId = setTimeout(() => {
    void adapter.joinMeeting(request);
  }, delay);

  return {
    id: `job_${Math.random().toString(36).slice(2)}`,
    userId: request.userId,
    eventId: request.event.id,
    joinAt: request.joinAt,
    cancel: () => clearTimeout(timeoutId),
  };
}

/**
 * Join immediately and return the join result.
 */
export async function joinNow(
  adapter: BotAdapter,
  request: BotJoinRequest
): Promise<BotJoinResult> {
  return adapter.joinMeeting(request);
}
