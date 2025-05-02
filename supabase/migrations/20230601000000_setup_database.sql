-- 1. Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Document storage
CREATE TABLE IF NOT EXISTS pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  user_id TEXT NOT NULL -- Using TEXT type for our hardcoded user ID
);

-- 3. Chunk storage (for vector search)
CREATE TABLE IF NOT EXISTS pdf_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding VECTOR(1024), -- For Jina embeddings-v3 (1024 dimensions)
  pdf_id UUID REFERENCES pdfs(id) ON DELETE CASCADE,
  metadata JSONB, -- Includes pdf_id and user_id
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 4. Create indexes for vector search
CREATE INDEX IF NOT EXISTS pdf_chunks_embedding_idx ON pdf_chunks
USING ivfflat (embedding vector_cosine_ops) 
WITH (lists = 100);

-- 5. Chat history
CREATE TABLE IF NOT EXISTS chat_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pdf_id UUID REFERENCES pdfs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Using TEXT type for our hardcoded user ID
  user_message TEXT NOT NULL,
  assistant_message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- 6. Create the match_documents function for vector similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1024),  -- The embedding vector for Jina v3
  match_count int DEFAULT 5,     
  filter jsonb DEFAULT '{}'      -- Optional filter criteria
) RETURNS TABLE (
  id bigint,
  content text,
  metadata jsonb,
  similarity float
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    pdf_chunks.id,
    pdf_chunks.content,
    pdf_chunks.metadata,
    1 - (pdf_chunks.embedding <=> query_embedding) AS similarity
  FROM pdf_chunks
  WHERE metadata @> filter
  ORDER BY pdf_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
LANGUAGE plpgsql
AS $$
#variable_conflict use_column
BEGIN
  RETURN QUERY
  SELECT
    pdf_chunks.id,
    pdf_chunks.content,
    pdf_chunks.metadata,
    1 - (pdf_chunks.embedding <=> query_embedding) AS similarity -- Cosine similarity
  FROM pdf_chunks
  WHERE 
    -- Apply the filter if it contains a pdf_id key
    (
      (filter->>'pdf_id' IS NULL) OR 
      (pdf_chunks.metadata->>'pdf_id' = filter->>'pdf_id')
    )
    -- Only include results above the similarity threshold
    AND 1 - (pdf_chunks.embedding <=> query_embedding) > similarity_threshold
  ORDER BY pdf_chunks.embedding <=> query_embedding -- Order by similarity
  LIMIT match_count;
END;
$$; 