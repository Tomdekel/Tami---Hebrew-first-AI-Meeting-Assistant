import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("integration_connections")
    .delete()
    .eq("user_id", user.id)
    .eq("provider", "google");

  if (error) {
    return NextResponse.json({ error: "Failed to disconnect Google" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
