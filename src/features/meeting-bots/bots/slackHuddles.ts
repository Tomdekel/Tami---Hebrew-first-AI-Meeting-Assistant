import { MeetingBotError } from "../errors";
import type { BotAdapter, BotJoinRequest, BotJoinResult } from "../types";
import { createNoopAudioCapture } from "../audio/capture";

export interface SlackHuddlesBotConfig {
  allowDiscreetMode?: boolean;
  apiAvailable?: boolean;
}

/**
 * Create a Slack Huddles bot adapter.
 */
export function createSlackHuddlesBotAdapter(config: SlackHuddlesBotConfig = {}): BotAdapter {
  return {
    platform: "slack_huddles",
    supportsDiscreetMode: Boolean(config.allowDiscreetMode),
    joinMeeting: async (request: BotJoinRequest): Promise<BotJoinResult> => {
      if (!config.apiAvailable) {
        throw new MeetingBotError(
          "SLACK_HUDDLES_UNSUPPORTED",
          "Slack Huddles bot join is not available without a supported API."
        );
      }
      if (request.mode === "discreet" && !config.allowDiscreetMode) {
        throw new MeetingBotError("SLACK_DISCREET_UNSUPPORTED", "Slack discreet mode is not available.");
      }

      return {
        joinId: `slack_${Math.random().toString(36).slice(2)}`,
        platform: "slack_huddles",
        mode: request.mode,
        audio: createNoopAudioCapture(request.audioConfig),
        joinedAt: new Date().toISOString(),
      };
    },
  };
}
