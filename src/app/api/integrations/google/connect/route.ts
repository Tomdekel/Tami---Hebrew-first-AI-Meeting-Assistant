import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildGoogleAuthUrl } from "@/features/meeting-bots/oauth/google";
import { getGoogleOAuthConfig } from "@/lib/integrations/config";
import { createOAuthState } from "@/lib/integrations/state";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const config = getGoogleOAuthConfig();
    const state = createOAuthState(user.id, "google");
    const authUrl = buildGoogleAuthUrl(config, state);

    return NextResponse.json({
      provider: "google",
      authUrl,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build auth url" },
      { status: 500 }
    );
  }
}
