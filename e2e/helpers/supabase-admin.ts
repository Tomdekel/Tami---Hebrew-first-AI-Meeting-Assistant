/**
 * Supabase Admin Client for E2E Test Seeding
 *
 * Uses service role key to bypass RLS and seed test data.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return adminClient;
}

export async function getUserIdByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.listUsers();

  if (error) {
    console.error("Error listing users:", error);
    return null;
  }

  const user = data.users.find((u) => u.email === email);
  return user?.id || null;
}
