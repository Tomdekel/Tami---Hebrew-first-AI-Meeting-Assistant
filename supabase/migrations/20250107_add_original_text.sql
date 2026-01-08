-- Add original_text column for storing pre-refinement text
-- This allows reverting refinement changes

ALTER TABLE transcript_segments
ADD COLUMN IF NOT EXISTS original_text TEXT;

-- Comment explaining the column
COMMENT ON COLUMN transcript_segments.original_text IS 'Stores the original unrefined text. NULL means text has not been refined.';
