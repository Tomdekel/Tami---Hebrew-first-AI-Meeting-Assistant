-- Function for vector similarity search within a specific session (for per-session chat RAG)
CREATE OR REPLACE FUNCTION match_embeddings(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.3,
  match_count int DEFAULT 10,
  p_session_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  session_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    me.id,
    me.session_id,
    me.content,
    me.metadata,
    1 - (me.embedding <=> query_embedding) as similarity
  FROM memory_embeddings me
  WHERE me.user_id = auth.uid()
    AND (p_session_id IS NULL OR me.session_id = p_session_id)
    AND 1 - (me.embedding <=> query_embedding) > match_threshold
  ORDER BY me.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
