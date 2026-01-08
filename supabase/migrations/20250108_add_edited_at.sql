-- Add edited_at column to summaries table for tracking user edits
-- When a user modifies the AI-generated summary, this timestamp is set

ALTER TABLE summaries
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

COMMENT ON COLUMN summaries.edited_at IS 'Timestamp when user last edited the summary. NULL means unedited AI-generated content.';
