-- Fix entity_mentions RLS policy to check both entity AND session ownership
-- This fixes the bug where entities show 0 related meetings

-- Drop existing policy
DROP POLICY IF EXISTS "Users can access own mentions" ON entity_mentions;

-- Create fixed policy that checks both entity AND session ownership
CREATE POLICY "Users can access own mentions" ON entity_mentions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM entities e
      WHERE e.id = entity_mentions.entity_id
        AND e.user_id = auth.uid()
    )
    AND
    EXISTS (
      SELECT 1 FROM sessions s
      WHERE s.id = entity_mentions.session_id
        AND s.user_id = auth.uid()
    )
  );
