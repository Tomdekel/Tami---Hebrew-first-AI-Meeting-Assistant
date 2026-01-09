-- Memory chat messages table for persisting global chat history
CREATE TABLE IF NOT EXISTS memory_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Index for efficient queries by user
CREATE INDEX IF NOT EXISTS idx_memory_chat_messages_user_id
  ON memory_chat_messages(user_id);

-- Index for ordering by time
CREATE INDEX IF NOT EXISTS idx_memory_chat_messages_created_at
  ON memory_chat_messages(user_id, created_at DESC);

-- Row Level Security
ALTER TABLE memory_chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own chat messages
CREATE POLICY "Users can view own memory chat messages"
  ON memory_chat_messages FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own chat messages
CREATE POLICY "Users can insert own memory chat messages"
  ON memory_chat_messages FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own chat messages
CREATE POLICY "Users can delete own memory chat messages"
  ON memory_chat_messages FOR DELETE
  USING (auth.uid() = user_id);
