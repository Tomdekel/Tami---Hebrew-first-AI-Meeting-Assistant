import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ConnectionRow {
  provider: "google" | "outlook";
  created_at: string;
  expires_at: string | null;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: connections, error } = await supabase
    .from("integration_connections")
    .select("provider, created_at, expires_at")
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch connections" },
      { status: 500 }
    );
  }

  const now = new Date();
  const providers: Array<"google" | "outlook"> = ["google", "outlook"];

  const result = providers.map((provider) => {
    const conn = (connections as ConnectionRow[] | null)?.find(
      (c) => c.provider === provider
    );
    const expiresAt = conn?.expires_at ? new Date(conn.expires_at) : null;

    return {
      provider,
      connected: !!conn,
      connectedAt: conn?.created_at ?? null,
      expiresAt: conn?.expires_at ?? null,
      expired: expiresAt ? expiresAt < now : false,
    };
  });

  return NextResponse.json({ connections: result });
}
