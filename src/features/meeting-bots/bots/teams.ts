import { MeetingBotError } from "../errors";
import type { BotAdapter, BotJoinRequest, BotJoinResult } from "../types";
import { createNoopAudioCapture } from "../audio/capture";

export interface TeamsBotConfig {
  allowDiscreetMode?: boolean;
}

/**
 * Create a Microsoft Teams bot adapter (placeholder for Teams SDK integration).
 */
export function createTeamsBotAdapter(config: TeamsBotConfig = {}): BotAdapter {
  return {
    platform: "microsoft_teams",
    supportsDiscreetMode: Boolean(config.allowDiscreetMode),
    joinMeeting: async (request: BotJoinRequest): Promise<BotJoinResult> => {
      if (request.mode === "discreet" && !config.allowDiscreetMode) {
        throw new MeetingBotError("TEAMS_DISCREET_UNSUPPORTED", "Teams discreet mode is not available.");
      }

      return {
        joinId: `teams_${Math.random().toString(36).slice(2)}`,
        platform: "microsoft_teams",
        mode: request.mode,
        audio: createNoopAudioCapture(request.audioConfig),
        joinedAt: new Date().toISOString(),
      };
    },
  };
}
