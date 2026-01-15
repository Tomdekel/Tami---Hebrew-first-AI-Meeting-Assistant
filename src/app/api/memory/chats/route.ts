import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: chats, error } = await supabase
    .from("memory_chats")
    .select("id, title, last_message_at, created_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const chatIds = (chats || []).map((chat) => chat.id);
  const lastMessageByChat = new Map<string, string>();

  if (chatIds.length > 0) {
    const { data: messages } = await supabase
      .from("memory_messages")
      .select("chat_id, content, created_at")
      .in("chat_id", chatIds)
      .order("created_at", { ascending: false });

    if (messages) {
      for (const message of messages) {
        if (!lastMessageByChat.has(message.chat_id)) {
          lastMessageByChat.set(message.chat_id, message.content || "");
        }
      }
    }
  }

  const normalized = (chats || []).map((chat) => ({
    id: chat.id,
    title: chat.title,
    last_message_at: chat.last_message_at,
    created_at: chat.created_at,
    lastMessage: lastMessageByChat.get(chat.id) || "",
  }));

  return NextResponse.json({ chats: normalized });
}

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
  const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New chat";

  const { data: chat, error } = await supabase
    .from("memory_chats")
    .insert({
      user_id: user.id,
      title,
      last_message_at: new Date().toISOString(),
    })
    .select("id, title, last_message_at, created_at")
    .single();

  if (error || !chat) {
    return NextResponse.json({ error: error?.message || "Failed to create chat" }, { status: 500 });
  }

  return NextResponse.json({ chat });
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const chatId = searchParams.get("id");

  if (!chatId) {
    return NextResponse.json({ error: "Chat id is required" }, { status: 400 });
  }

  const { data: chat } = await supabase
    .from("memory_chats")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .single();

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  await supabase.from("memory_messages").delete().eq("chat_id", chatId);
  await supabase.from("memory_chats").delete().eq("id", chatId);

  return NextResponse.json({ success: true });
}
