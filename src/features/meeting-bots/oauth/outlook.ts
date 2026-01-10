import { MeetingBotError } from "../errors";
import type { CalendarEvent, CalendarFetchOptions, OAuthClientConfig, OAuthTokens } from "../types";
import { detectMeetingPlatform } from "../selection/platform";

const OUTLOOK_SCOPES = ["offline_access", "Calendars.Read", "Calendars.ReadWrite"];

/**
 * Build a Microsoft OAuth authorization URL for Outlook Calendar access.
 */
export function buildOutlookAuthUrl(config: OAuthClientConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    response_mode: "query",
    scope: config.scopes.join(" "),
    state,
  });

  return `${config.authBaseUrl}?${params.toString()}`;
}

/**
 * Exchange a Microsoft OAuth authorization code for tokens.
 */
export async function exchangeOutlookCode(
  config: OAuthClientConfig,
  code: string
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code,
    scope: config.scopes.join(" "),
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new MeetingBotError("OUTLOOK_TOKEN_EXCHANGE_FAILED", "Failed to exchange Outlook OAuth code.");
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  };

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
    scope: json.scope,
    tokenType: json.token_type,
    idToken: json.id_token,
  };
}

/**
 * Refresh Outlook OAuth tokens.
 */
export async function refreshOutlookToken(
  config: OAuthClientConfig,
  refreshToken: string
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    scope: config.scopes.join(" "),
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new MeetingBotError("OUTLOOK_TOKEN_REFRESH_FAILED", "Failed to refresh Outlook OAuth token.");
  }

  const json = (await response.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  };

  return {
    accessToken: json.access_token,
    refreshToken,
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : undefined,
    scope: json.scope,
    tokenType: json.token_type,
    idToken: json.id_token,
  };
}

/**
 * Fetch upcoming Outlook Calendar events with meeting links.
 */
export async function fetchOutlookCalendarEvents(
  tokens: OAuthTokens,
  options: CalendarFetchOptions = {}
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams();
  const start = options.timeMin ?? new Date().toISOString();
  const end = options.timeMax ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  params.set("startDateTime", start);
  params.set("endDateTime", end);
  params.set("$top", String(options.maxResults ?? 50));

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendarview?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    }
  );

  if (!response.ok) {
    throw new MeetingBotError("OUTLOOK_EVENTS_FETCH_FAILED", "Failed to fetch Outlook Calendar events.");
  }

  const json = (await response.json()) as {
    value?: Array<{
      id: string;
      subject?: string;
      start?: { dateTime?: string; timeZone?: string };
      end?: { dateTime?: string; timeZone?: string };
      body?: { content?: string };
      onlineMeeting?: { joinUrl?: string };
      organizer?: { emailAddress?: { address?: string } };
      attendees?: Array<{ emailAddress?: { address?: string; name?: string }; type?: string }>;
    }>;
  };

  const items = json.value ?? [];
  return items.map((item) => {
    const meetingUrl = item.onlineMeeting?.joinUrl;
    return {
      id: item.id,
      title: item.subject ?? "(untitled)",
      startTime: item.start?.dateTime ?? "",
      endTime: item.end?.dateTime ?? "",
      timezone: item.start?.timeZone,
      meetingUrl,
      platform: detectMeetingPlatform(meetingUrl),
      attendees: item.attendees
        ?.map((attendee) => ({
          email: attendee.emailAddress?.address ?? "",
          displayName: attendee.emailAddress?.name,
          isOrganizer: attendee.type === "organizer",
        }))
        .filter((attendee) => attendee.email),
      organizerEmail: item.organizer?.emailAddress?.address,
      raw: item as Record<string, unknown>,
    };
  });
}

/**
 * Default Outlook OAuth configuration presets.
 */
export function getOutlookOAuthDefaults(): Pick<OAuthClientConfig, "authBaseUrl" | "tokenUrl" | "scopes"> {
  return {
    authBaseUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scopes: OUTLOOK_SCOPES,
  };
}
