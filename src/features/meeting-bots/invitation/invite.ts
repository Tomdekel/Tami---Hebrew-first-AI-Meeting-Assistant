import { MeetingBotError } from "../errors";
import type { BotInviteRequest, BotInviteResult, OAuthTokens } from "../types";

/**
 * Generate a shareable invitation link for a bot based on the meeting URL.
 */
export function generateBotInvitationLink(meetingUrl?: string): string | undefined {
  if (!meetingUrl) {
    return undefined;
  }
  return meetingUrl;
}

/**
 * Add a bot attendee to a Google Calendar event.
 */
export async function addBotToGoogleEvent(
  request: BotInviteRequest,
  tokens: OAuthTokens
): Promise<BotInviteResult> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${request.eventId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        attendees: [{ email: request.botIdentity.email }],
      }),
    }
  );

  if (!response.ok) {
    throw new MeetingBotError("GOOGLE_EVENT_INVITE_FAILED", "Failed to add bot to Google event.");
  }

  return {
    eventId: request.eventId,
    updated: true,
  };
}

/**
 * Add a bot attendee to a Microsoft Outlook event.
 */
export async function addBotToOutlookEvent(
  request: BotInviteRequest,
  tokens: OAuthTokens
): Promise<BotInviteResult> {
  const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${request.eventId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      attendees: [
        {
          emailAddress: { address: request.botIdentity.email, name: request.botIdentity.displayName },
          type: "required",
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new MeetingBotError("OUTLOOK_EVENT_INVITE_FAILED", "Failed to add bot to Outlook event.");
  }

  return {
    eventId: request.eventId,
    updated: true,
  };
}
