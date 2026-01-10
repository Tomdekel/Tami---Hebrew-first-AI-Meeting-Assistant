import { MeetingBotError } from "../errors";
import type { CalendarEvent, CalendarFetchOptions, OAuthClientConfig, OAuthTokens } from "../types";
import { detectMeetingPlatform } from "../selection/platform";

const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
];

/**
 * Build a Google OAuth authorization URL for Calendar access.
 */
export function buildGoogleAuthUrl(config: OAuthClientConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `${config.authBaseUrl}?${params.toString()}`;
}

/**
 * Exchange a Google OAuth authorization code for tokens.
 */
export async function exchangeGoogleCode(
  config: OAuthClientConfig,
  code: string
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
    code,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new MeetingBotError("GOOGLE_TOKEN_EXCHANGE_FAILED", "Failed to exchange Google OAuth code.");
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
 * Refresh Google OAuth tokens.
 */
export async function refreshGoogleToken(
  config: OAuthClientConfig,
  refreshToken: string
): Promise<OAuthTokens> {
  const params = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new MeetingBotError("GOOGLE_TOKEN_REFRESH_FAILED", "Failed to refresh Google OAuth token.");
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
 * Fetch upcoming Google Calendar events with meeting links.
 */
export async function fetchGoogleCalendarEvents(
  tokens: OAuthTokens,
  options: CalendarFetchOptions = {}
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: options.timeMin ?? new Date().toISOString(),
    maxResults: String(options.maxResults ?? 50),
    singleEvents: "true",
    orderBy: "startTime",
  });

  if (options.timeMax) {
    params.set("timeMax", options.timeMax);
  }
  if (options.query) {
    params.set("q", options.query);
  }
  if (options.includeCancelled) {
    params.set("showDeleted", "true");
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    }
  );

  if (!response.ok) {
    throw new MeetingBotError("GOOGLE_EVENTS_FETCH_FAILED", "Failed to fetch Google Calendar events.");
  }

  const json = (await response.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      start?: { dateTime?: string; date?: string; timeZone?: string };
      end?: { dateTime?: string; date?: string; timeZone?: string };
      organizer?: { email?: string };
      attendees?: Array<{ email?: string; displayName?: string; organizer?: boolean }>;
      hangoutLink?: string;
      conferenceData?: { entryPoints?: Array<{ uri?: string }> };
    }>;
  };

  const items = json.items ?? [];
  return items.map((item) => {
    const meetingUrl =
      item.hangoutLink ||
      item.conferenceData?.entryPoints?.find((entry) => entry.uri)?.uri ||
      undefined;
    return {
      id: item.id,
      title: item.summary ?? "(untitled)",
      startTime: item.start?.dateTime ?? item.start?.date ?? "",
      endTime: item.end?.dateTime ?? item.end?.date ?? "",
      timezone: item.start?.timeZone,
      meetingUrl,
      platform: detectMeetingPlatform(meetingUrl),
      attendees: item.attendees
        ?.map((attendee) => ({
          email: attendee.email ?? "",
          displayName: attendee.displayName,
          isOrganizer: attendee.organizer,
        }))
        .filter((attendee) => attendee.email),
      organizerEmail: item.organizer?.email,
      raw: item as Record<string, unknown>,
    };
  });
}

/**
 * Default Google OAuth configuration presets.
 */
export function getGoogleOAuthDefaults(): Pick<OAuthClientConfig, "authBaseUrl" | "tokenUrl" | "scopes"> {
  return {
    authBaseUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: GOOGLE_CALENDAR_SCOPES,
  };
}
