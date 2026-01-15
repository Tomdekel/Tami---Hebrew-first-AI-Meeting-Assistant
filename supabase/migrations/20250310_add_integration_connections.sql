-- OAuth integration connections for calendar providers

CREATE TABLE IF NOT EXISTS integration_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google', 'outlook')),
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  scope TEXT,
  token_type TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_integration_connections_user_id ON integration_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_connections_provider ON integration_connections(provider);

ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integration connections"
  ON integration_connections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integration connections"
  ON integration_connections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integration connections"
  ON integration_connections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integration connections"
  ON integration_connections FOR DELETE
  USING (auth.uid() = user_id);
