import { MeetingBotError } from "../errors";
import type { BotAdapter, BotJoinRequest, BotJoinResult } from "../types";
import { createNoopAudioCapture } from "../audio/capture";

export interface GoogleMeetBotConfig {
  allowDiscreetMode?: boolean;
}

/**
 * Create a Google Meet bot adapter (placeholder for native Meet APIs).
 */
export function createGoogleMeetBotAdapter(config: GoogleMeetBotConfig = {}): BotAdapter {
  return {
    platform: "google_meet",
    supportsDiscreetMode: Boolean(config.allowDiscreetMode),
    joinMeeting: async (request: BotJoinRequest): Promise<BotJoinResult> => {
      if (request.mode === "discreet" && !config.allowDiscreetMode) {
        throw new MeetingBotError("MEET_DISCREET_UNSUPPORTED", "Google Meet discreet mode is not available.");
      }

      return {
        joinId: `meet_${Math.random().toString(36).slice(2)}`,
        platform: "google_meet",
        mode: request.mode,
        audio: createNoopAudioCapture(request.audioConfig),
        joinedAt: new Date().toISOString(),
      };
    },
  };
}
