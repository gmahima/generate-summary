-- Function to match PDF chunks based on vector similarity
-- This function is used by SupabaseVectorStore for semantic search

CREATE OR REPLACE FUNCTION match_pdf_chunks(
  query_vector vector(1024),  -- Adjust dimension to match your Jina embeddings
  pdf_id_filter text,
  match_limit int DEFAULT 5
) RETURNS TABLE (
  id text,
  content text,
  metadata jsonb
) LANGUAGE sql AS $$
  SELECT
    id::text,
    content,
    metadata
  FROM 
    pdf_chunks
  WHERE 
    metadata->>'pdf_id' = pdf_id_filter
  ORDER BY 
    embedding <=> query_vector
  LIMIT 
    match_limit;
$$;

-- Alternative version with different parameter names if needed
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1024),
  filter text,
  match_count int DEFAULT 5
) 
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    pc.id,
    pc.content,
    pc.metadata,
    1 - (pc.embedding <=> query_embedding) as similarity
  FROM
    pdf_chunks pc
  WHERE
    pc.metadata->>'pdf_id' = filter
  ORDER BY
    pc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

COMMENT ON FUNCTION match_pdf_chunks IS 'Function for semantic search over PDF chunks with embeddings';
COMMENT ON FUNCTION match_documents IS 'Alternative function name for semantic search over document chunks'; 