import { getGoogleOAuthDefaults } from "@/features/meeting-bots/oauth/google";
import { getOutlookOAuthDefaults } from "@/features/meeting-bots/oauth/outlook";
import type { OAuthClientConfig } from "@/features/meeting-bots/types";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name} environment variable`);
  }
  return value;
}

export function getGoogleOAuthConfig(): OAuthClientConfig {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
    redirectUri: requireEnv("GOOGLE_REDIRECT_URI"),
    ...getGoogleOAuthDefaults(),
  };
}

export function getOutlookOAuthConfig(): OAuthClientConfig {
  return {
    clientId: requireEnv("OUTLOOK_CLIENT_ID"),
    clientSecret: requireEnv("OUTLOOK_CLIENT_SECRET"),
    redirectUri: requireEnv("OUTLOOK_REDIRECT_URI"),
    ...getOutlookOAuthDefaults(),
  };
}
