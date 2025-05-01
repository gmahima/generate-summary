-- Function to check the raw embedding type and format
CREATE OR REPLACE FUNCTION raw_embedding_check(row_id uuid)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  embedding_type text;
  embedding_info text;
  sample_vector vector(1024);
BEGIN
  -- Get the datatype of the embedding column
  SELECT pg_typeof(embedding)::text INTO embedding_type
  FROM pdf_chunks 
  WHERE id = row_id;
  
  -- Get additional info about the embedding
  SELECT 
    CASE 
      WHEN embedding IS NULL THEN 'NULL'
      WHEN embedding_type = 'vector' THEN 
        'vector with ' || array_length(embedding::float8[], 1) || ' dimensions'
      WHEN embedding_type = 'text' OR embedding_type = 'character varying' THEN
        'text with length ' || length(embedding::text)
      ELSE 'unknown format' 
    END INTO embedding_info
  FROM pdf_chunks
  WHERE id = row_id;
  
  -- Try to get a sample of the vector
  BEGIN
    SELECT embedding INTO sample_vector 
    FROM pdf_chunks
    WHERE id = row_id;
    
    -- If we get here, embedding is a valid vector
    embedding_info := embedding_info || ', first 3 values: [' || 
                     sample_vector[1]::text || ', ' || 
                     sample_vector[2]::text || ', ' || 
                     sample_vector[3]::text || ']';
  EXCEPTION WHEN OTHERS THEN
    -- Not a valid vector
    embedding_info := embedding_info || ', not a valid vector';
  END;
  
  RETURN 'Type: ' || embedding_type || ', ' || embedding_info;
END;
$$;

-- Function to test if vector operations work on the embedding
CREATE OR REPLACE FUNCTION test_vector_operation(row_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  test_results jsonb := '{}'::jsonb;
  sample_vector vector(1024);
  zero_vector vector(1024) := array_fill(0::float8, ARRAY[1024])::vector(1024);
  similarity float8;
BEGIN
  -- Try to get the embedding vector
  BEGIN
    SELECT embedding INTO sample_vector 
    FROM pdf_chunks
    WHERE id = row_id;
    
    test_results := jsonb_set(test_results, '{get_vector}', '"success"');
  EXCEPTION WHEN OTHERS THEN
    test_results := jsonb_set(test_results, '{get_vector}', '"error: ' || SQLERRM || '"');
    RETURN test_results;
  END;
  
  -- Try a simple distance calculation
  BEGIN
    SELECT 1 - (sample_vector <=> zero_vector) INTO similarity;
    test_results := jsonb_set(test_results, '{vector_distance}', '"success"');
    test_results := jsonb_set(test_results, '{similarity}', to_jsonb(similarity));
  EXCEPTION WHEN OTHERS THEN
    test_results := jsonb_set(test_results, '{vector_distance}', '"error: ' || SQLERRM || '"');
  END;
  
  RETURN test_results;
END;
$$; 