-- Add is_deleted column for soft deletion of transcript segments
-- Used by deep refinement to mark hallucinated/incoherent segments
ALTER TABLE transcript_segments ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;
