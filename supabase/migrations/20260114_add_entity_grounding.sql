-- Add grounding columns to entity_mentions for LangExtract source grounding
-- This enables character-level tracking of where entities were extracted from

-- Add grounding columns to entity_mentions
ALTER TABLE entity_mentions
ADD COLUMN IF NOT EXISTS start_offset INTEGER,
ADD COLUMN IF NOT EXISTS end_offset INTEGER,
ADD COLUMN IF NOT EXISTS confidence REAL;

-- Add unique constraint for cross-type deduplication
-- This ensures the same normalized entity isn't stored multiple times with different types
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'entities_user_normalized_unique'
    ) THEN
        ALTER TABLE entities
        ADD CONSTRAINT entities_user_normalized_unique
        UNIQUE (user_id, normalized_value);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN
        NULL; -- Constraint already exists
END $$;

-- Create index for faster entity lookups by normalized_value
CREATE INDEX IF NOT EXISTS idx_entities_normalized_value
ON entities (user_id, normalized_value);

-- Create index for confidence-based filtering
CREATE INDEX IF NOT EXISTS idx_entity_mentions_confidence
ON entity_mentions (confidence)
WHERE confidence IS NOT NULL;
