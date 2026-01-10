# Meeting Bots Module (Isolated)

## Overview
This module provides an isolated, TypeScript-first API surface for joining meetings with bots and capturing raw audio only. It is intentionally decoupled from the existing Tami pipeline and data model. Use it to connect calendars, select meetings, schedule joins, and expose raw audio streams/files for later transcription.

Supported platforms (adapters):
- Zoom
- Google Meet
- Microsoft Teams
- Slack Huddles (only when a supported bot API is available)
- Recall.ai (optional adapter for cross-platform joins)

## Exported APIs (High-Level)
- OAuth: `buildGoogleAuthUrl`, `exchangeGoogleCode`, `refreshGoogleToken`, `fetchGoogleCalendarEvents`
- OAuth: `buildOutlookAuthUrl`, `exchangeOutlookCode`, `refreshOutlookToken`, `fetchOutlookCalendarEvents`
- Consent: `logConsent`, `getConsentLog`
- Selection: `applySelectionRules`, `createMeetingSelection`, `detectMeetingPlatform`
- In-memory storage: `saveEvents`, `getEvents`, `saveSelection`, `getSelections`, `saveOAuthTokens`, `getOAuthTokens`
- Invites: `generateBotInvitationLink`, `addBotToGoogleEvent`, `addBotToOutlookEvent`
- Bots: `createZoomBotAdapter`, `createGoogleMeetBotAdapter`, `createTeamsBotAdapter`, `createSlackHuddlesBotAdapter`, `createRecallAiAdapter`
- Scheduler: `scheduleBotJoin`, `joinNow`
- Service: `createMeetingBotService`
- Hook: `useMeetingBotSelection`

## Usage Examples

### 1) OAuth + calendar fetch (Google)
```ts
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGoogleCalendarEvents,
  getGoogleOAuthDefaults,
  logConsent,
} from "@/features/meeting-bots";

const config = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: "https://example.com/oauth/google/callback",
  ...getGoogleOAuthDefaults(),
};

const state = "opaque_state_here";
const authUrl = buildGoogleAuthUrl(config, state);
logConsent("user_123", "google", config.scopes, "Calendar connection requested");

// After callback:
const tokens = await exchangeGoogleCode(config, "auth_code_here");
const events = await fetchGoogleCalendarEvents(tokens, { maxResults: 25 });
```

### 2) Rule-based meeting selection
```ts
import { applySelectionRules, createMeetingSelection } from "@/features/meeting-bots";

const rules = [
  {
    id: "rule_team",
    includeTitleKeywords: ["weekly"],
    requiredParticipants: ["teamlead@company.com"],
    platform: ["google_meet", "zoom"],
  },
];

const matching = applySelectionRules(events, rules);
const selection = createMeetingSelection("user_123", events, rules, "visible");
```

### 3) Schedule a bot to join and capture raw audio
```ts
import {
  createMeetingBotService,
  createZoomBotAdapter,
} from "@/features/meeting-bots";

const service = createMeetingBotService({
  adapters: {
    zoom: createZoomBotAdapter({ allowDiscreetMode: false }),
  },
});

const job = service.scheduleJoin({
  userId: "user_123",
  event: events[0],
  mode: "visible",
  botIdentity: { displayName: "Tami Bot", email: "bot@company.com" },
  joinAt: events[0].startTime,
  audioConfig: { format: "wav", sampleRateHz: 48000, channels: 1 },
});
```

## Integration Notes
- This module is isolated from existing API routes, database logic, and AI pipelines.
- When wiring in later:
  - The `New Meeting` page can call OAuth helpers and store tokens in its own persistence layer.
  - The `joinMeeting`/`scheduleJoin` outputs should be forwarded to the transcription pipeline only after raw audio is complete.
  - Replace placeholder adapters with real Zoom/Meet/Teams SDK integrations or Recall.ai as needed.

## Dependencies & Setup
- No additional runtime dependencies are required beyond Node 18+ (for `fetch`) and React (for the optional hook).
- OAuth helpers require client IDs/secrets configured in the integrating environment.
- Slack Huddles support requires a verified bot join API; otherwise the adapter throws a `SLACK_HUDDLES_UNSUPPORTED` error.
