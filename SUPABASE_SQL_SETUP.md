# Setting up SQL Functions in Supabase

To set up the required SQL functions for the vector search functionality, follow these steps:

## Prerequisites

- Access to your Supabase project dashboard
- Admin privileges to run SQL commands

## Steps to Set Up SQL Functions

1. Log in to your Supabase dashboard at [https://app.supabase.com/](https://app.supabase.com/)
2. Select your project
3. Navigate to the SQL Editor (in the left sidebar)
4. Create a new query (click the "+" button)
5. Paste the following SQL code:

```sql
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

-- Optional: Add a function comment
COMMENT ON FUNCTION match_pdf_chunks IS 'Function for semantic search over PDF chunks with embeddings';
```

6. Click "Run" to execute the SQL
7. You should see a success message if the function was created correctly

## Testing the Function

To verify the function works correctly, you can run a test query:

```sql
-- Test with a sample vector (all zeros) and a PDF ID
-- Replace 'your-pdf-id-here' with an actual PDF ID from your database
SELECT * FROM match_pdf_chunks(
  array_fill(0::float8, ARRAY[1024])::vector(1024),
  'your-pdf-id-here',
  5
);
```

## Troubleshooting

If you encounter errors related to the vector dimensions, make sure the vector dimension in the function matches your embedding model's output dimensions.

For Jina embeddings, this should be 1024 dimensions as specified in the function.

## Additional Information

This function is used by the application's vector search functionality to find relevant chunks of text based on semantic similarity between the query vector and the stored chunk embeddings. 