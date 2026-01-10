export type BotMode = "visible" | "discreet";

export type MeetingPlatform =
  | "zoom"
  | "google_meet"
  | "microsoft_teams"
  | "slack_huddles"
  | "unknown";

export type OAuthProvider = "google" | "outlook";

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
  tokenType?: string;
  idToken?: string;
}

export interface OAuthClientConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authBaseUrl: string;
  tokenUrl: string;
}

export interface CalendarEventAttendee {
  email: string;
  displayName?: string;
  isOrganizer?: boolean;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  timezone?: string;
  meetingUrl?: string;
  platform: MeetingPlatform;
  attendees?: CalendarEventAttendee[];
  organizerEmail?: string;
  tags?: string[];
  raw?: Record<string, unknown>;
}

export interface CalendarFetchOptions {
  timeMin?: string;
  timeMax?: string;
  query?: string;
  maxResults?: number;
  includeCancelled?: boolean;
}

export interface MeetingSelectionRule {
  id: string;
  includeTitleKeywords?: string[];
  excludeTitleKeywords?: string[];
  requiredParticipants?: string[];
  tags?: string[];
  platform?: MeetingPlatform[];
  titleRegex?: string;
  mode?: BotMode;
}

export interface MeetingSelection {
  id: string;
  userId: string;
  createdAt: string;
  ruleIds: string[];
  eventIds: string[];
  mode?: BotMode;
}

export interface BotIdentity {
  displayName: string;
  email?: string;
}

export interface AudioCaptureConfig {
  format: "wav" | "mp3" | "opus" | "raw";
  sampleRateHz?: number;
  channels?: number;
}

export interface AudioCaptureHandle {
  id: string;
  startedAt: string;
  format: AudioCaptureConfig["format"];
  stream?: NodeJS.ReadableStream;
  filePath?: string;
  stop: () => Promise<void>;
}

export interface BotJoinRequest {
  userId: string;
  event: CalendarEvent;
  mode: BotMode;
  botIdentity: BotIdentity;
  joinAt: string;
  audioConfig: AudioCaptureConfig;
}

export interface BotJoinResult {
  joinId: string;
  platform: MeetingPlatform;
  mode: BotMode;
  audio?: AudioCaptureHandle;
  joinedAt: string;
}

export interface BotAdapter {
  platform: MeetingPlatform;
  supportsDiscreetMode: boolean;
  joinMeeting: (request: BotJoinRequest) => Promise<BotJoinResult>;
}

export interface BotInviteRequest {
  userId: string;
  provider: OAuthProvider;
  eventId: string;
  botIdentity: BotIdentity;
}

export interface BotInviteResult {
  eventId: string;
  invitationLink?: string;
  updated?: boolean;
}

export interface MeetingBotSchedulerJob {
  id: string;
  userId: string;
  eventId: string;
  joinAt: string;
  cancel: () => void;
}

export interface ConsentLogEntry {
  userId: string;
  provider: OAuthProvider;
  scopes: string[];
  timestamp: string;
  notes?: string;
}

export interface BotIntegrationConfig {
  zoom?: Record<string, unknown>;
  googleMeet?: Record<string, unknown>;
  teams?: Record<string, unknown>;
  slackHuddles?: Record<string, unknown>;
  recallAi?: Record<string, unknown>;
}
