import { MeetingBotError } from "../errors";
import type { BotAdapter, BotJoinRequest, BotJoinResult } from "../types";
import { createNoopAudioCapture } from "../audio/capture";

export interface ZoomBotConfig {
  allowDiscreetMode?: boolean;
}

/**
 * Create a Zoom bot adapter (placeholder for Zoom SDK integration).
 */
export function createZoomBotAdapter(config: ZoomBotConfig = {}): BotAdapter {
  return {
    platform: "zoom",
    supportsDiscreetMode: Boolean(config.allowDiscreetMode),
    joinMeeting: async (request: BotJoinRequest): Promise<BotJoinResult> => {
      if (request.mode === "discreet" && !config.allowDiscreetMode) {
        throw new MeetingBotError("ZOOM_DISCREET_UNSUPPORTED", "Zoom discreet mode is not available.");
      }

      return {
        joinId: `zoom_${Math.random().toString(36).slice(2)}`,
        platform: "zoom",
        mode: request.mode,
        audio: createNoopAudioCapture(request.audioConfig),
        joinedAt: new Date().toISOString(),
      };
    },
  };
}
