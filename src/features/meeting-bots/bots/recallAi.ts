import { MeetingBotError } from "../errors";
import type { BotAdapter, BotJoinRequest, BotJoinResult, MeetingPlatform } from "../types";
import { createInMemoryAudioCapture } from "../audio/capture";

export interface RecallAiConfig {
  apiKey?: string;
  apiBaseUrl?: string;
  supportedPlatforms?: MeetingPlatform[];
}

/**
 * Create a Recall.ai bot adapter (placeholder for cross-platform bot joining).
 */
export function createRecallAiAdapter(config: RecallAiConfig = {}): BotAdapter {
  return {
    platform: "unknown",
    supportsDiscreetMode: true,
    joinMeeting: async (request: BotJoinRequest): Promise<BotJoinResult> => {
      if (!config.apiKey) {
        throw new MeetingBotError("RECALL_AI_NOT_CONFIGURED", "Recall.ai API key is missing.");
      }
      if (config.supportedPlatforms && !config.supportedPlatforms.includes(request.event.platform)) {
        throw new MeetingBotError("RECALL_AI_PLATFORM_UNSUPPORTED", "Recall.ai does not support this platform.");
      }

      const baseUrl = config.apiBaseUrl ?? "https://api.recall.ai";
      const response = await fetch(`${baseUrl}/bot`, {
        method: "POST",
        headers: {
          Authorization: `Token ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meeting_url: request.event.meetingUrl,
          bot_name: request.botIdentity.displayName,
          is_visible: request.mode === "visible",
        }),
      });

      if (!response.ok) {
        throw new MeetingBotError("RECALL_AI_JOIN_FAILED", "Failed to create Recall.ai bot.");
      }

      return {
        joinId: `recall_${Math.random().toString(36).slice(2)}`,
        platform: request.event.platform,
        mode: request.mode,
        audio: createInMemoryAudioCapture(request.audioConfig),
        joinedAt: new Date().toISOString(),
      };
    },
  };
}
