-- Add memory chats/messages, processing step tracking, and attachment chunks for stable deep links

-- ===========================================
-- 1) Memory chats (threads)
-- ===========================================
CREATE TABLE IF NOT EXISTS memory_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_memory_chats_user_id ON memory_chats(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_chats_last_message_at ON memory_chats(user_id, last_message_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_chats_default_per_user ON memory_chats(user_id) WHERE is_default;

ALTER TABLE memory_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory chats"
  ON memory_chats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory chats"
  ON memory_chats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory chats"
  ON memory_chats FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memory chats"
  ON memory_chats FOR DELETE
  USING (auth.uid() = user_id);

-- ===========================================
-- 2) Memory messages with evidence payloads
-- ===========================================
CREATE TABLE IF NOT EXISTS memory_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES memory_chats(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  evidence_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_messages_chat_id ON memory_messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_memory_messages_created_at ON memory_messages(chat_id, created_at DESC);

ALTER TABLE memory_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memory messages"
  ON memory_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM memory_chats mc
      WHERE mc.id = memory_messages.chat_id
      AND mc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own memory messages"
  ON memory_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memory_chats mc
      WHERE mc.id = memory_messages.chat_id
      AND mc.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own memory messages"
  ON memory_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memory_chats mc
      WHERE mc.id = memory_messages.chat_id
      AND mc.user_id = auth.uid()
    )
  );

-- ===========================================
-- 3) Session processing step tracking (JSON)
-- ===========================================
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS processing_state TEXT DEFAULT 'draft'
    CHECK (processing_state IN ('draft', 'processing', 'completed', 'failed')),
  ADD COLUMN IF NOT EXISTS processing_steps JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS current_step TEXT;

-- Backfill processing_state for existing rows
UPDATE sessions
SET processing_state = CASE
  WHEN status = 'completed' THEN 'completed'
  WHEN status IN ('failed', 'expired') THEN 'failed'
  WHEN status IN ('processing', 'refining', 'pending', 'recording') THEN 'processing'
  ELSE 'draft'
END
WHERE processing_state IS NULL;

-- ===========================================
-- 4) Attachment chunks for stable deep links
-- ===========================================
CREATE TABLE IF NOT EXISTS attachment_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id UUID NOT NULL REFERENCES attachments(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  page_number INTEGER,
  sheet_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (attachment_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_attachment_chunks_user_id ON attachment_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_attachment_chunks_session_id ON attachment_chunks(session_id);
CREATE INDEX IF NOT EXISTS idx_attachment_chunks_attachment_id ON attachment_chunks(attachment_id);

ALTER TABLE attachment_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attachment chunks"
  ON attachment_chunks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attachment chunks"
  ON attachment_chunks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attachment chunks"
  ON attachment_chunks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own attachment chunks"
  ON attachment_chunks FOR DELETE
  USING (auth.uid() = user_id);
