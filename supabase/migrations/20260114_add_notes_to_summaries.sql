-- Add notes column to summaries table for timestamped sections
-- Notes contain: title, emoji, startTime, endTime, bullets[]

ALTER TABLE summaries ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]';

-- Add index for faster queries on notes
CREATE INDEX IF NOT EXISTS idx_summaries_notes ON summaries USING GIN (notes);

COMMENT ON COLUMN summaries.notes IS 'Array of timestamped note sections with emoji, title, and bullet points';
