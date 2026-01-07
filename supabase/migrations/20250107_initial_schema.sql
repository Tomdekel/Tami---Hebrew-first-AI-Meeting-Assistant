-- Tami-2 Initial Database Schema
-- Run this migration in your Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ===========================================
-- Sessions (Meetings)
-- ===========================================
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  context TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'recording', 'processing', 'completed', 'failed')),
  audio_url TEXT,
  detected_language TEXT CHECK (detected_language IN ('he', 'en', 'auto')),
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster user queries
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- ===========================================
-- Transcripts
-- ===========================================
CREATE TABLE IF NOT EXISTS transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  language TEXT,
  full_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One transcript per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_transcripts_session_id ON transcripts(session_id);

-- ===========================================
-- Transcript Segments (for speaker diarization)
-- ===========================================
CREATE TABLE IF NOT EXISTS transcript_segments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transcript_id UUID NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  speaker_name TEXT,
  text TEXT NOT NULL,
  start_time FLOAT NOT NULL,
  end_time FLOAT NOT NULL,
  segment_order INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_transcript_segments_transcript_id ON transcript_segments(transcript_id);
CREATE INDEX IF NOT EXISTS idx_transcript_segments_order ON transcript_segments(transcript_id, segment_order);

-- ===========================================
-- Summaries
-- ===========================================
CREATE TABLE IF NOT EXISTS summaries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  overview TEXT,
  key_points JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- One summary per session
CREATE UNIQUE INDEX IF NOT EXISTS idx_summaries_session_id ON summaries(session_id);

-- ===========================================
-- Action Items
-- ===========================================
CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  summary_id UUID NOT NULL REFERENCES summaries(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  assignee TEXT,
  deadline DATE,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_items_summary_id ON action_items(summary_id);
CREATE INDEX IF NOT EXISTS idx_action_items_completed ON action_items(completed);

-- ===========================================
-- Entities (extracted from transcripts)
-- ===========================================
CREATE TABLE IF NOT EXISTS entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('person', 'organization', 'project', 'topic', 'location', 'date', 'product', 'technology', 'other')),
  value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  mention_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entities_user_id ON entities(user_id);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(user_id, type);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entities_unique ON entities(user_id, type, normalized_value);

-- ===========================================
-- Entity Mentions (links entities to sessions)
-- ===========================================
CREATE TABLE IF NOT EXISTS entity_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity_id ON entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_session_id ON entity_mentions(session_id);

-- ===========================================
-- Tags
-- ===========================================
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'auto:person', 'auto:organization', 'auto:project', 'auto:topic')),
  is_visible BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_unique ON tags(user_id, name);

-- ===========================================
-- Session Tags (many-to-many)
-- ===========================================
CREATE TABLE IF NOT EXISTS session_tags (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_session_tags_session_id ON session_tags(session_id);
CREATE INDEX IF NOT EXISTS idx_session_tags_tag_id ON session_tags(tag_id);

-- ===========================================
-- Chat Messages (Q&A about meetings)
-- ===========================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(session_id, created_at);

-- ===========================================
-- Memory Embeddings (for cross-meeting search)
-- ===========================================
CREATE TABLE IF NOT EXISTS memory_embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(768), -- Gemini embedding dimension
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_embeddings_user_id ON memory_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_session_id ON memory_embeddings(session_id);

-- Enable vector search with IVFFlat index
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_vector ON memory_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ===========================================
-- Row Level Security (RLS)
-- ===========================================

-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcript_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_embeddings ENABLE ROW LEVEL SECURITY;

-- Sessions: Users can only access their own sessions
CREATE POLICY "Users can access own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);

-- Transcripts: Users can access transcripts of their sessions
CREATE POLICY "Users can access own transcripts" ON transcripts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = transcripts.session_id AND sessions.user_id = auth.uid())
  );

-- Transcript Segments: Users can access segments of their transcripts
CREATE POLICY "Users can access own transcript segments" ON transcript_segments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM transcripts t
      JOIN sessions s ON s.id = t.session_id
      WHERE t.id = transcript_segments.transcript_id AND s.user_id = auth.uid()
    )
  );

-- Summaries: Users can access summaries of their sessions
CREATE POLICY "Users can access own summaries" ON summaries
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = summaries.session_id AND sessions.user_id = auth.uid())
  );

-- Action Items: Users can access action items of their summaries
CREATE POLICY "Users can access own action items" ON action_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM summaries sum
      JOIN sessions s ON s.id = sum.session_id
      WHERE sum.id = action_items.summary_id AND s.user_id = auth.uid()
    )
  );

-- Entities: Users can only access their own entities
CREATE POLICY "Users can access own entities" ON entities
  FOR ALL USING (auth.uid() = user_id);

-- Entity Mentions: Users can access mentions of their entities
CREATE POLICY "Users can access own entity mentions" ON entity_mentions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM entities WHERE entities.id = entity_mentions.entity_id AND entities.user_id = auth.uid())
  );

-- Tags: Users can only access their own tags
CREATE POLICY "Users can access own tags" ON tags
  FOR ALL USING (auth.uid() = user_id);

-- Session Tags: Users can access tags of their sessions
CREATE POLICY "Users can access own session tags" ON session_tags
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = session_tags.session_id AND sessions.user_id = auth.uid())
  );

-- Chat Messages: Users can access messages of their sessions
CREATE POLICY "Users can access own chat messages" ON chat_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM sessions WHERE sessions.id = chat_messages.session_id AND sessions.user_id = auth.uid())
  );

-- Memory Embeddings: Users can only access their own embeddings
CREATE POLICY "Users can access own embeddings" ON memory_embeddings
  FOR ALL USING (auth.uid() = user_id);

-- ===========================================
-- Functions
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON action_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_entities_updated_at
  BEFORE UPDATE ON entities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Storage Buckets
-- ===========================================
-- Run these in the Supabase dashboard or via API:
--
-- INSERT INTO storage.buckets (id, name, public) VALUES ('audio', 'audio', false);
--
-- CREATE POLICY "Users can upload own audio" ON storage.objects
--   FOR INSERT WITH CHECK (
--     bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]
--   );
--
-- CREATE POLICY "Users can access own audio" ON storage.objects
--   FOR SELECT USING (
--     bucket_id = 'audio' AND auth.uid()::text = (storage.foldername(name))[1]
--   );
