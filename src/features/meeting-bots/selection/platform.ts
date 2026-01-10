import type { MeetingPlatform } from "../types";

/**
 * Detect meeting platform from a meeting URL.
 */
export function detectMeetingPlatform(meetingUrl?: string): MeetingPlatform {
  if (!meetingUrl) {
    return "unknown";
  }
  const normalized = meetingUrl.toLowerCase();
  if (normalized.includes("zoom.us")) {
    return "zoom";
  }
  if (normalized.includes("meet.google.com")) {
    return "google_meet";
  }
  if (normalized.includes("teams.microsoft.com") || normalized.includes("teams.live.com")) {
    return "microsoft_teams";
  }
  if (normalized.includes("slack.com") && normalized.includes("/huddle/")) {
    return "slack_huddles";
  }
  return "unknown";
}
