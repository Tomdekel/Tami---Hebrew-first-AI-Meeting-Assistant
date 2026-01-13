-- Person-Based Retrieval Schema
-- Enables deterministic filtering for queries like "meetings with Amichai"

-- ============================================
-- 1. PEOPLE TABLE - Canonical person identities
-- ============================================
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  normalized_key TEXT NOT NULL,  -- lowercase, trimmed for matching
  aliases TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, normalized_key)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
CREATE INDEX IF NOT EXISTS idx_people_normalized_key ON people(user_id, normalized_key);

-- RLS
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own people"
  ON people FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own people"
  ON people FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own people"
  ON people FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own people"
  ON people FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 2. SESSION_SPEAKERS TABLE - Speaker → Person mapping
-- ============================================
CREATE TABLE IF NOT EXISTS session_speakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,  -- e.g., "spk_01" from transcript
  label TEXT NOT NULL,       -- display label, defaults to "Speaker 01"
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id, speaker_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_speakers_session_id ON session_speakers(session_id);
CREATE INDEX IF NOT EXISTS idx_session_speakers_person_id ON session_speakers(person_id);

-- RLS (inherit from session ownership)
ALTER TABLE session_speakers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view speakers for their sessions"
  ON session_speakers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_speakers.session_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert speakers for their sessions"
  ON session_speakers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_speakers.session_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update speakers for their sessions"
  ON session_speakers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_speakers.session_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete speakers for their sessions"
  ON session_speakers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_speakers.session_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================
-- 3. SESSION_PEOPLE TABLE - Filter index (the retrieval gate)
-- ============================================
CREATE TABLE IF NOT EXISTS session_people (
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  confidence FLOAT DEFAULT 1.0,
  evidence JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_id, person_id)
);

-- Indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_session_people_person_id ON session_people(person_id);
CREATE INDEX IF NOT EXISTS idx_session_people_session_id ON session_people(session_id);

-- RLS
ALTER TABLE session_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view session_people for their sessions"
  ON session_people FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_people.session_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert session_people for their sessions"
  ON session_people FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_people.session_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update session_people for their sessions"
  ON session_people FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_people.session_id
      AND s.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete session_people for their sessions"
  ON session_people FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = session_people.session_id
      AND s.user_id = auth.uid()
    )
  );

-- ============================================
-- 4. SPEAKER_ASSIGNMENT_EVENTS TABLE - Audit log
-- ============================================
CREATE TABLE IF NOT EXISTS speaker_assignment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_id TEXT NOT NULL,
  old_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  new_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_speaker_assignment_events_user_id ON speaker_assignment_events(user_id);
CREATE INDEX IF NOT EXISTS idx_speaker_assignment_events_session_id ON speaker_assignment_events(session_id);

-- RLS
ALTER TABLE speaker_assignment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own assignment events"
  ON speaker_assignment_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own assignment events"
  ON speaker_assignment_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- 5. FILTERED EMBEDDING SEARCH FUNCTION
-- ============================================
CREATE OR REPLACE FUNCTION search_embeddings_filtered(
  query_embedding vector(1536),
  filter_session_ids UUID[],
  match_threshold float DEFAULT 0.35,
  match_count int DEFAULT 10,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    me.id,
    me.session_id,
    me.content,
    me.metadata,
    1 - (me.embedding <=> query_embedding) as similarity
  FROM memory_embeddings me
  WHERE me.user_id = p_user_id
    AND me.session_id = ANY(filter_session_ids)
    AND 1 - (me.embedding <=> query_embedding) > match_threshold
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================
-- 6. HELPER FUNCTION: Find sessions by person
-- ============================================
CREATE OR REPLACE FUNCTION get_sessions_for_person(
  p_person_id UUID,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID[]
LANGUAGE plpgsql
AS $$
DECLARE
  result UUID[];
BEGIN
  SELECT ARRAY_AGG(sp.session_id)
  INTO result
  FROM session_people sp
  JOIN sessions s ON s.id = sp.session_id
  WHERE sp.person_id = p_person_id
    AND s.user_id = p_user_id;

  RETURN COALESCE(result, '{}');
END;
$$;

-- ============================================
-- 7. HELPER FUNCTION: Find person by name/alias
-- ============================================
CREATE OR REPLACE FUNCTION find_person_by_name(
  p_name TEXT,
  p_user_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  result UUID;
  normalized TEXT;
BEGIN
  normalized := LOWER(TRIM(p_name));

  -- Try exact match on normalized_key first
  SELECT id INTO result
  FROM people
  WHERE user_id = p_user_id
    AND normalized_key = normalized
  LIMIT 1;

  IF result IS NOT NULL THEN
    RETURN result;
  END IF;

  -- Try alias match
  SELECT id INTO result
  FROM people
  WHERE user_id = p_user_id
    AND normalized = ANY(
      SELECT LOWER(TRIM(alias)) FROM unnest(aliases) AS alias
    )
  LIMIT 1;

  RETURN result;
END;
$$;
