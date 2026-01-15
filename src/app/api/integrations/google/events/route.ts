import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchGoogleCalendarEvents, refreshGoogleToken } from "@/features/meeting-bots/oauth/google";
import { getGoogleOAuthConfig } from "@/lib/integrations/config";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: connection } = await supabase
    .from("integration_connections")
    .select("access_token, refresh_token, expires_at, scope, token_type")
    .eq("user_id", user.id)
    .eq("provider", "google")
    .single();

  if (!connection) {
    return NextResponse.json({ error: "Google not connected" }, { status: 404 });
  }

  let accessToken = connection.access_token;
  let refreshToken = connection.refresh_token;
  let expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : null;

  try {
    if (expiresAt && expiresAt < Date.now() && refreshToken) {
      const config = getGoogleOAuthConfig();
      const refreshed = await refreshGoogleToken(config, refreshToken);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken || refreshToken;
      expiresAt = refreshed.expiresAt || null;

      await supabase
        .from("integration_connections")
        .update({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          scope: refreshed.scope || connection.scope,
          token_type: refreshed.tokenType || connection.token_type,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id)
        .eq("provider", "google");
    }

    const tokens = {
      accessToken,
      refreshToken: refreshToken || undefined,
      expiresAt: expiresAt || undefined,
      scope: connection.scope || undefined,
      tokenType: connection.token_type || undefined,
    };

    const { searchParams } = new URL(request.url);
    const maxResults = parseInt(searchParams.get("limit") || "50", 10);
    const timeMin = searchParams.get("timeMin") || undefined;
    const timeMax = searchParams.get("timeMax") || undefined;

    const events = await fetchGoogleCalendarEvents(tokens, { maxResults, timeMin, timeMax });

    return NextResponse.json({ events });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch Google events" },
      { status: 500 }
    );
  }
}
