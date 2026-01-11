-- Add transcription timeout tracking and error metadata
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transcription_error TEXT,
  ADD COLUMN IF NOT EXISTS transcription_error_code TEXT;

ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_status_check;

ALTER TABLE sessions
  ADD CONSTRAINT sessions_status_check
  CHECK (status IN ('pending', 'recording', 'processing', 'refining', 'completed', 'failed', 'expired'));
