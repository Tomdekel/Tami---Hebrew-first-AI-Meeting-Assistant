-- Relationship suggestions table for AI-proposed relationships pending user review
CREATE TABLE IF NOT EXISTS relationship_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  source_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  source_value TEXT NOT NULL,
  target_value TEXT NOT NULL,
  source_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  context TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_relationship_suggestions_user ON relationship_suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_relationship_suggestions_session ON relationship_suggestions(session_id);
CREATE INDEX IF NOT EXISTS idx_relationship_suggestions_status ON relationship_suggestions(status);

-- Enable RLS
ALTER TABLE relationship_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can only access their own suggestions
CREATE POLICY "Users can view own relationship suggestions"
  ON relationship_suggestions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own relationship suggestions"
  ON relationship_suggestions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own relationship suggestions"
  ON relationship_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own relationship suggestions"
  ON relationship_suggestions FOR DELETE
  USING (auth.uid() = user_id);
