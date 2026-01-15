-- Add evidence payload to chat messages
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS evidence_json JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_chat_messages_evidence ON chat_messages USING gin (evidence_json);
