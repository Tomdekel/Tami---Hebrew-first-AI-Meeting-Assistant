-- Migration: Add transcript ingestion support
-- Sprint 1: Enable importing transcripts from external sources (Google Meet, Zoom, Teams, etc.)

-- Add source tracking columns to sessions table
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'recorded'
  CHECK (source_type IN ('recorded', 'imported', 'summary_only'));

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS source_metadata JSONB DEFAULT '{}';

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS has_timestamps BOOLEAN DEFAULT false;

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS ingestion_confidence TEXT DEFAULT 'high'
  CHECK (ingestion_confidence IN ('high', 'medium', 'low'));

-- Add origin tracking columns to transcripts table
ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'asr'
  CHECK (origin IN ('asr', 'imported'));

ALTER TABLE transcripts
ADD COLUMN IF NOT EXISTS external_format TEXT
  CHECK (external_format IS NULL OR external_format IN ('vtt', 'srt', 'text', 'doc', 'pdf', 'md'));

-- Add index for filtering by source type
CREATE INDEX IF NOT EXISTS idx_sessions_source_type ON sessions(source_type);

-- Update existing sessions to have has_timestamps = true (since they all came from recordings)
UPDATE sessions
SET has_timestamps = true
WHERE source_type = 'recorded' AND has_timestamps = false;

COMMENT ON COLUMN sessions.source_type IS 'Origin of the meeting content: recorded (via Tami), imported (transcript upload), or summary_only (text summary only)';
COMMENT ON COLUMN sessions.source_metadata IS 'Additional metadata about the source (e.g., original filename, email sender)';
COMMENT ON COLUMN sessions.has_timestamps IS 'Whether the transcript has timing information for segments';
COMMENT ON COLUMN sessions.ingestion_confidence IS 'Confidence level based on content completeness: high (timestamps+speakers+content), medium (missing one), low (text only)';
COMMENT ON COLUMN transcripts.origin IS 'How the transcript was created: asr (speech recognition) or imported (uploaded file)';
COMMENT ON COLUMN transcripts.external_format IS 'Original file format for imported transcripts: vtt, srt, text, doc, pdf, md';
