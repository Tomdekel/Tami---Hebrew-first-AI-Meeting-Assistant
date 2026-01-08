-- Add decisions column to summaries table

ALTER TABLE summaries
ADD COLUMN IF NOT EXISTS decisions JSONB DEFAULT '[]';

-- Comment explaining the column
COMMENT ON COLUMN summaries.decisions IS 'Array of decisions made during the meeting: [{description: string, context: string | null}]';
