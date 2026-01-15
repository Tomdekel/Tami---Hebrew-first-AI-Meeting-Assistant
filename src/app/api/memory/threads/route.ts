import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/memory/threads - List all memory chat threads
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: threads, error } = await supabase
    .from("memory_chats")
    .select(
      `
      id,
      title,
      is_default,
      created_at,
      updated_at,
      last_message_at
    `
    )
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch threads" },
      { status: 500 }
    );
  }

  // Get message count for each thread
  const threadsWithCount = await Promise.all(
    (threads || []).map(async (thread) => {
      const { count } = await supabase
        .from("memory_messages")
        .select("id", { count: "exact", head: true })
        .eq("chat_id", thread.id);

      // Get last message preview
      const { data: lastMessage } = await supabase
        .from("memory_messages")
        .select("content, role")
        .eq("chat_id", thread.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return {
        id: thread.id,
        title: thread.title || "New conversation",
        isDefault: thread.is_default,
        messageCount: count || 0,
        lastMessage: lastMessage?.content?.slice(0, 100) || null,
        lastMessageRole: lastMessage?.role || null,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at,
        lastMessageAt: thread.last_message_at,
      };
    })
  );

  return NextResponse.json({ threads: threadsWithCount });
}

// POST /api/memory/threads - Create a new thread
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { title } = body;

  const { data: thread, error } = await supabase
    .from("memory_chats")
    .insert({
      user_id: user.id,
      title: title || null,
      is_default: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Failed to create thread" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      thread: {
        id: thread.id,
        title: thread.title || "New conversation",
        isDefault: thread.is_default,
        messageCount: 0,
        lastMessage: null,
        createdAt: thread.created_at,
        updatedAt: thread.updated_at,
        lastMessageAt: thread.last_message_at,
      },
    },
    { status: 201 }
  );
}

// DELETE /api/memory/threads?threadId=... - Delete a thread
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const threadId = searchParams.get("threadId");

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!threadId) {
    return NextResponse.json(
      { error: "threadId query param required" },
      { status: 400 }
    );
  }

  // Verify ownership
  const { data: thread } = await supabase
    .from("memory_chats")
    .select("id, user_id, is_default")
    .eq("id", threadId)
    .single();

  if (!thread || thread.user_id !== user.id) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  if (thread.is_default) {
    return NextResponse.json(
      { error: "Cannot delete default thread" },
      { status: 400 }
    );
  }

  // Delete thread (messages cascade)
  const { error } = await supabase
    .from("memory_chats")
    .delete()
    .eq("id", threadId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to delete thread" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
