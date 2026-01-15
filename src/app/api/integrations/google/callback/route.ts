import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeGoogleCode } from "@/features/meeting-bots/oauth/google";
import { getGoogleOAuthConfig } from "@/lib/integrations/config";
import { verifyOAuthState } from "@/lib/integrations/state";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");

  if (!code || !stateParam) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const state = verifyOAuthState(stateParam);
  if (!state || state.provider !== "google" || state.userId !== user.id) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  try {
    const config = getGoogleOAuthConfig();
    const tokens = await exchangeGoogleCode(config, code);

    const expiresAt = tokens.expiresAt ? new Date(tokens.expiresAt).toISOString() : null;

    const { error } = await supabase
      .from("integration_connections")
      .upsert({
        user_id: user.id,
        provider: "google",
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken || null,
        expires_at: expiresAt,
        scope: tokens.scope || null,
        token_type: tokens.tokenType || null,
        metadata: { id_token: tokens.idToken || null },
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,provider" });

    if (error) {
      throw error;
    }

    return NextResponse.redirect(new URL("/meetings/new?integration=google&connected=1", request.url));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect Google" },
      { status: 500 }
    );
  }
}
