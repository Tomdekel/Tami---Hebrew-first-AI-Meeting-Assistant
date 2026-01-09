import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function MeetingsPage() {
  const supabase = await createClient()

  // Get the current user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Get the most recent meeting
  const { data: sessions } = await supabase
    .from("sessions")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)

  if (sessions && sessions.length > 0) {
    redirect(`/meetings/${sessions[0].id}`)
  }

  // If no meetings exist, redirect to new meeting page
  redirect("/meetings/new")
}
