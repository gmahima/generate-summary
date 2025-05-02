"use server";

/**
 * Simple test function to verify server actions are working
 */
export async function testServerAction(): Promise<{
  status: string;
  message: string;
}> {
  console.log("✅ TEST: Server action was called successfully");

  try {
    // Test environment variables
    const envVars = {
      JINA_API_KEY: process.env.JINA_API_KEY ? "Present" : "Missing",
      GROQ_API_KEY: process.env.GROQ_API_KEY ? "Present" : "Missing",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL
        ? "Present"
        : "Missing",
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
        ? "Present"
        : "Missing",
    };

    console.log("📋 Environment variables status:", envVars);

    return {
      status: "success",
      message: `Server action executed successfully. Environment variables: ${JSON.stringify(envVars)}`,
    };
  } catch (error) {
    console.error("❌ Error in test server action:", error);
    return {
      status: "error",
      message: `Error executing server action: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Test database connection and check PDF chunks
 */
export async function testDatabaseAccess(pdfId: string): Promise<{
  status: string;
  message: string;
  data?: {
    sampleChunks?: Record<string, unknown>[];
    columns?: Record<string, unknown>[];
    tables?: Record<string, unknown>[];
  };
}> {
  console.log("✅ TEST: Database access check started");

  try {
    // Import the createClient function from supabase
    const { createClient } = await import("@supabase/supabase-js");

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        status: "error",
        message: "Missing Supabase credentials",
      };
    }

    console.log("🔌 Connecting to Supabase...");
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Test basic connection by getting database schema
    const { data: tablesData, error: tablesError } = await supabaseClient
      .from("pg_tables")
      .select("tablename")
      .limit(5);

    if (tablesError) {
      console.error("❌ Error connecting to database:", tablesError);
      return {
        status: "error",
        message: `Failed to connect to database: ${tablesError.message}`,
      };
    }

    // Check PDF chunks for the specified PDF ID
    console.log(`🔍 Checking for chunks with PDF ID: ${pdfId}`);
    const { data: chunksData, error: chunksError } = await supabaseClient
      .from("pdf_chunks")
      .select("id, content", { count: "exact" })
      .filter("metadata->>pdf_id", "eq", pdfId)
      .limit(2);

    if (chunksError) {
      console.error("❌ Error querying pdf_chunks:", chunksError);
      return {
        status: "error",
        message: `Failed to query pdf_chunks: ${chunksError.message}`,
      };
    }

    // Check if the table exists but no chunks for this PDF
    const { count: totalCount } = await supabaseClient
      .from("pdf_chunks")
      .select("id", { count: "exact", head: true });

    // Check embeddings columns
    const { data: columnsData } = await supabaseClient
      .from("information_schema.columns")
      .select("column_name")
      .eq("table_name", "pdf_chunks");

    return {
      status: "success",
      message: `Database connection successful. Found ${chunksData?.length || 0} chunks for PDF ID ${pdfId} (out of ${totalCount || 0} total chunks)`,
      data: {
        sampleChunks: chunksData || [],
        columns: columnsData || [],
        tables: tablesData || [],
      },
    };
  } catch (error) {
    console.error("❌ Error in database test:", error);
    return {
      status: "error",
      message: `Error testing database: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Test Jina embeddings generation
 */
export async function testEmbeddings(): Promise<{
  status: string;
  message: string;
  data?: {
    embedding?: number[];
  };
}> {
  console.log("✅ TEST: Jina embeddings test started");

  try {
    // Import JinaEmbeddings
    const { JinaEmbeddings } = await import(
      "@langchain/community/embeddings/jina"
    );

    // Check API key
    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) {
      return {
        status: "error",
        message: "JINA_API_KEY environment variable is not set",
      };
    }

    console.log("🧠 Creating Jina embeddings instance...");
    // Initialize Jina embeddings
    const embeddings = new JinaEmbeddings({
      apiKey,
      model: "jina-embeddings-v3", // Using Jina's latest embedding model with 1024 dimensions
    });

    // Generate a test embedding
    console.log("🔄 Generating test embedding...");
    const testText = "This is a test of the Jina embeddings API.";
    const embedding = await embeddings.embedQuery(testText);

    // Check if embedding was generated successfully
    if (!embedding || embedding.length === 0) {
      return {
        status: "error",
        message: "Failed to generate embedding - received empty result",
      };
    }

    return {
      status: "success",
      message: `Successfully generated embedding with ${embedding.length} dimensions`,
      data: {
        embedding: embedding.slice(0, 5), // Just show the first 5 dimensions for preview
      },
    };
  } catch (error) {
    console.error("❌ Error in embeddings test:", error);
    return {
      status: "error",
      message: `Error testing embeddings: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Test Supabase vector store and similarity search
 */
export async function testVectorStore(pdfId: string): Promise<{
  status: string;
  message: string;
  data?: {
    retrievedDocs?: { content: string; metadata: Record<string, unknown> }[];
  };
}> {
  console.log("✅ TEST: Supabase vector store test started");

  try {
    // Import required modules
    const { JinaEmbeddings } = await import(
      "@langchain/community/embeddings/jina"
    );
    const { SupabaseVectorStore } = await import(
      "@langchain/community/vectorstores/supabase"
    );
    const { createClient } = await import("@supabase/supabase-js");

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        status: "error",
        message: "Missing Supabase credentials",
      };
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if JINA_API_KEY is set
    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) {
      return {
        status: "error",
        message: "JINA_API_KEY environment variable is not set",
      };
    }

    // Initialize Jina embeddings
    console.log("🧠 Creating Jina embeddings instance...");
    const embeddings = new JinaEmbeddings({
      apiKey,
      model: "jina-embeddings-v3",
    });

    // First check if there are chunks for this PDF
    console.log(`🔍 Checking for chunks with PDF ID: ${pdfId}`);
    const { count, error: countError } = await supabaseClient
      .from("pdf_chunks")
      .select("*", { count: "exact", head: true })
      .filter("metadata->>pdf_id", "eq", pdfId);

    if (countError) {
      return {
        status: "error",
        message: `Error checking for chunks: ${countError.message}`,
      };
    }

    if (count === 0) {
      return {
        status: "warning",
        message: `No chunks found for PDF ID: ${pdfId}. Vector search can't work without chunks.`,
      };
    }

    console.log(`📊 Found ${count} chunks for PDF ID: ${pdfId}`);

    // Create the vector store directly
    console.log("🔍 Creating vector store...");
    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabaseClient,
      tableName: "pdf_chunks",
      queryName: "match_pdf_chunks",
    });

    // Try direct similarity search
    console.log("🔎 Testing similarity search with sample query...");
    const testQuery = "summary of the document";

    // Add more diagnostic info
    console.log(`🔍 Using PDF ID filter: ${pdfId}`);

    // Check database directly for this PDF ID
    const { count: directCount, error: directCountError } = await supabaseClient
      .from("pdf_chunks")
      .select("id", { count: "exact", head: true })
      .filter("metadata->>pdf_id", "eq", pdfId);

    console.log(
      `🔍 Direct database check: ${directCount || 0} chunks found with metadata->>pdf_id = ${pdfId}`,
    );

    if (directCountError) {
      console.error("❌ Error in direct count:", directCountError);
    }

    // Try a raw SQL query to see what's in the database
    try {
      const { data: rawChunks } = await supabaseClient
        .from("pdf_chunks")
        .select("id, metadata")
        .limit(5);

      console.log(
        "🔍 Sample chunks in database:",
        rawChunks?.map((c) => ({ id: c.id, pdf_id: c.metadata?.pdf_id })) ||
          "No chunks",
      );
    } catch (e) {
      console.error("❌ Error checking raw chunks:", e);
    }

    // Try the similaritySearch method without any filter
    const docs = await vectorStore.similaritySearch(testQuery, 2);

    console.log(`✅ Retrieved ${docs.length} documents (no filter)`);

    return {
      status: "success",
      message: `Vector store search results: ${docs.length} docs (no filter), ${directCount || 0} from direct database check`,
      data: {
        retrievedDocs:
          docs.length > 0
            ? docs.map((doc) => ({
                content: doc.pageContent.substring(0, 100) + "...",
                metadata: doc.metadata,
              }))
            : [],
      },
    };
  } catch (error) {
    console.error("❌ Error in vector store test:", error);
    return {
      status: "error",
      message: `Error testing vector store: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Simple database content check - just counting rows and examining structure
 */
export async function checkDatabaseContent(): Promise<{
  status: string;
  message: string;
  data?: Record<string, unknown>;
}> {
  console.log("🔍 Starting basic database content check");

  try {
    // Import the createClient function from supabase
    const { createClient } = await import("@supabase/supabase-js");

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        status: "error",
        message: "Missing Supabase credentials",
      };
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Instead of querying information_schema, we'll use a direct approach to check for tables
    try {
      console.log("📋 Checking if pdf_chunks table exists by querying it...");

      // Try to count rows in pdf_chunks
      const { count: chunkCount, error: countError } = await supabaseClient
        .from("pdf_chunks")
        .select("*", { count: "exact", head: true });

      if (countError) {
        console.error("❌ Error counting chunks:", countError);
        return {
          status: "error",
          message: `Error accessing pdf_chunks table: ${countError.message}`,
        };
      }

      console.log(`📊 Found ${chunkCount || 0} rows in pdf_chunks table`);

      if (chunkCount === 0) {
        return {
          status: "warning",
          message:
            "pdf_chunks table exists but has no rows. PDF processing may have failed or no PDFs have been processed yet.",
        };
      }

      // Get a sample of the data
      const { data: sampleData, error: sampleError } = await supabaseClient
        .from("pdf_chunks")
        .select("*")
        .limit(1);

      if (sampleError) {
        console.error("❌ Error getting sample data:", sampleError);
        return {
          status: "error",
          message: `Error getting sample data: ${sampleError.message}`,
        };
      }

      if (!sampleData || sampleData.length === 0) {
        return {
          status: "warning",
          message: "pdf_chunks table exists but could not retrieve sample data",
        };
      }

      console.log(
        "📋 First sample data row properties:",
        Object.keys(sampleData[0]),
      );

      // Check if sample data has right structure
      const hasContent = "content" in sampleData[0];
      const hasMetadata = "metadata" in sampleData[0];
      const hasEmbedding = "embedding" in sampleData[0];

      console.log(
        `📊 Sample data structure check: content=${hasContent}, metadata=${hasMetadata}, embedding=${hasEmbedding}`,
      );

      // Examine the embedding if it exists
      let embeddingInfo = "No embedding found";
      if (hasEmbedding) {
        const embedding = sampleData[0].embedding;
        if (embedding) {
          if (Array.isArray(embedding)) {
            embeddingInfo = `Embedding is an array with ${embedding.length} elements`;
          } else if (typeof embedding === "object") {
            embeddingInfo = `Embedding is an object with ${Object.keys(embedding).length} keys`;
          } else {
            embeddingInfo = `Embedding is type: ${typeof embedding}`;
          }
        } else {
          embeddingInfo = "Embedding field exists but is null/undefined";
        }
      }

      return {
        status: "success",
        message: `Database check complete: ${chunkCount} rows in pdf_chunks table. ${embeddingInfo}`,
        data: {
          chunkCount,
          sampleData: {
            id: sampleData[0].id,
            content_preview: sampleData[0].content?.substring(0, 100),
            metadata: sampleData[0].metadata,
            has_embedding: hasEmbedding,
            embedding_info: embeddingInfo,
          },
        },
      };
    } catch (dbError) {
      console.error("❌ Error in database operations:", dbError);
      return {
        status: "error",
        message: `Database error: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
      };
    }
  } catch (error) {
    console.error("❌ Error checking database content:", error);
    return {
      status: "error",
      message: `Error checking database content: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check if match_documents function exists and fix common issues
 */
export async function checkMatchDocumentsFunction(): Promise<{
  status: string;
  message: string;
}> {
  console.log("🔍 Checking match_documents function");

  try {
    // Import the createClient function from supabase
    const { createClient } = await import("@supabase/supabase-js");

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        status: "error",
        message: "Missing Supabase credentials",
      };
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if the function exists by trying to call it with minimal parameters
    try {
      console.log("🧪 Testing match_documents function with dummy data...");

      // Create a dummy embedding (all zeros) of length 1024 (Jina embedding size)
      const dummyEmbedding = Array(1024).fill(0);

      const { data, error } = await supabaseClient.rpc("match_documents", {
        query_embedding: dummyEmbedding,
        match_count: 1,
      });

      if (error) {
        console.error("❌ Error calling match_documents:", error);

        // Check if error indicates function doesn't exist
        if (
          error.message.includes("function") &&
          error.message.includes("does not exist")
        ) {
          return {
            status: "error",
            message:
              "match_documents function does not exist. This is required for vector similarity search to work.",
          };
        }

        return {
          status: "error",
          message: `Error calling match_documents: ${error.message}`,
        };
      }

      console.log(
        `✅ match_documents function exists and returned ${data?.length || 0} results`,
      );

      return {
        status: "success",
        message: `match_documents function exists and works correctly. Returned ${data?.length || 0} results with test query.`,
      };
    } catch (functionError) {
      console.error(
        "❌ Error testing match_documents function:",
        functionError,
      );
      return {
        status: "error",
        message: `Error testing match_documents function: ${functionError instanceof Error ? functionError.message : String(functionError)}`,
      };
    }
  } catch (error) {
    console.error("❌ Error checking match_documents function:", error);
    return {
      status: "error",
      message: `Error checking match_documents function: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Fix database embeddings by reprocessing existing chunks
 */
export async function fixDatabaseEmbeddings(): Promise<{
  status: string;
  message: string;
}> {
  console.log("🔧 Starting database embedding fix");

  try {
    // Import required dependencies
    const { createClient } = await import("@supabase/supabase-js");
    const { JinaEmbeddings } = await import(
      "@langchain/community/embeddings/jina"
    );
    const { SupabaseVectorStore } = await import(
      "@langchain/community/vectorstores/supabase"
    );
    const { Document } = await import("@langchain/core/documents");

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        status: "error",
        message: "Missing Supabase credentials",
      };
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get existing chunks from the database
    console.log("📋 Retrieving existing chunks from database...");
    const { data: existingChunks, error: chunkError } = await supabaseClient
      .from("pdf_chunks")
      .select("id, content, metadata")
      .limit(100); // Limit to 100 chunks for safety

    if (chunkError) {
      console.error("❌ Error retrieving chunks:", chunkError);
      return {
        status: "error",
        message: `Error retrieving chunks: ${chunkError.message}`,
      };
    }

    if (!existingChunks || existingChunks.length === 0) {
      return {
        status: "warning",
        message: "No chunks found in database to fix",
      };
    }

    console.log(`📊 Found ${existingChunks.length} chunks to reprocess`);

    // Initialize Jina embeddings
    console.log("🧠 Creating Jina embeddings instance...");
    const apiKey = process.env.JINA_API_KEY;
    if (!apiKey) {
      return {
        status: "error",
        message: "JINA_API_KEY environment variable is not set",
      };
    }

    const embeddings = new JinaEmbeddings({
      apiKey,
      model: "jina-embeddings-v3",
    });

    // Convert to Document objects
    const documents = existingChunks.map(
      (chunk) =>
        new Document({
          pageContent: chunk.content,
          metadata: chunk.metadata,
        }),
    );

    // Store documents with proper vector embeddings
    try {
      console.log("🔄 Creating new vector embeddings...");

      // Create a temporary table for the new embeddings
      const tempTableName = `pdf_chunks_fixed_${Date.now()}`;

      // First try to create the new table using the from documents approach
      console.log(
        `📋 Creating new table ${tempTableName} with proper vector embeddings...`,
      );
      await SupabaseVectorStore.fromDocuments(documents, embeddings, {
        client: supabaseClient,
        tableName: tempTableName,
        queryName: "match_documents",
      });

      console.log("✅ Successfully created new embeddings");

      // Test the new table with a simple query
      console.log("🧪 Testing new embeddings...");
      const testEmbedding = await embeddings.embedQuery("test query");

      const { data: testResults, error: testError } = await supabaseClient.rpc(
        "match_documents",
        {
          query_embedding: testEmbedding,
          match_count: 1,
          table_name: tempTableName,
        },
      );

      if (testError) {
        console.error("❌ Error testing new embeddings:", testError);
        return {
          status: "error",
          message: `Created new table but testing failed: ${testError.message}`,
        };
      }

      console.log(
        `✅ Test successful, returned ${testResults?.length || 0} results`,
      );

      return {
        status: "success",
        message: `Created new table '${tempTableName}' with fixed vector embeddings. Got ${testResults?.length || 0} results in test query. Use this table instead of pdf_chunks.`,
      };
    } catch (fixError) {
      console.error("❌ Error fixing embeddings:", fixError);
      return {
        status: "error",
        message: `Error fixing embeddings: ${fixError instanceof Error ? fixError.message : String(fixError)}`,
      };
    }
  } catch (error) {
    console.error("❌ Error in fixDatabaseEmbeddings:", error);
    return {
      status: "error",
      message: `Error fixing database embeddings: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Test match_documents with a very low similarity threshold
 */
export async function testMatchDocumentsLowThreshold(): Promise<{
  status: string;
  message: string;
}> {
  console.log("🔍 Testing match_documents with low similarity threshold");

  try {
    // Import required modules
    const { createClient } = await import("@supabase/supabase-js");

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        status: "error",
        message: "Missing Supabase credentials",
      };
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Create a dummy embedding (all zeros) of length 1024 (Jina embedding size)
    const dummyEmbedding = Array(1024).fill(0);

    // Try with different similarity thresholds
    const thresholdResults = [];

    for (const threshold of [0.5, 0.2, 0.1, 0.01, 0.0]) {
      console.log(`🧪 Testing with similarity_threshold = ${threshold}`);

      try {
        const { data, error } = await supabaseClient.rpc("match_documents", {
          query_embedding: dummyEmbedding,
          match_count: 10,
          similarity_threshold: threshold,
        });

        if (error) {
          console.error(`❌ Error with threshold ${threshold}:`, error);
          thresholdResults.push(
            `Threshold ${threshold}: Error: ${error.message}`,
          );
        } else {
          console.log(
            `✅ Threshold ${threshold}: Got ${data?.length || 0} results`,
          );
          thresholdResults.push(
            `Threshold ${threshold}: ${data?.length || 0} results`,
          );

          // Show a sample of the first result if any
          if (data && data.length > 0) {
            console.log("First result sample:", {
              id: data[0].id,
              similarity: data[0].similarity,
              content_preview: data[0].content.substring(0, 50) + "...",
            });
          }
        }
      } catch (err) {
        console.error(`❌ Exception with threshold ${threshold}:`, err);
        thresholdResults.push(
          `Threshold ${threshold}: Exception: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      status: "success",
      message: `Tested match_documents with various thresholds:\n${thresholdResults.join("\n")}`,
    };
  } catch (error) {
    console.error(
      "❌ Error testing match_documents with low threshold:",
      error,
    );
    return {
      status: "error",
      message: `Error testing match_documents: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Check the structure and format of the embedding column
 */
export async function inspectEmbeddingFormat(): Promise<{
  status: string;
  message: string;
  data?: {
    columnInfo?: Record<string, unknown>[];
    embeddingColumn?: Record<string, unknown>;
    sampleEmbedding?: {
      type: string;
      details: string;
    };
  };
}> {
  console.log("🔍 Inspecting embedding column format");

  try {
    // Import required modules
    const { createClient } = await import("@supabase/supabase-js");

    // Initialize Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

    if (!supabaseUrl || !supabaseServiceKey) {
      return {
        status: "error",
        message: "Missing Supabase credentials",
      };
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get information about the table structure
    console.log("📊 Checking table structure...");
    const { data: columnInfo, error: columnError } = await supabaseClient
      .from("information_schema.columns")
      .select("column_name, data_type, udt_name")
      .eq("table_name", "pdf_chunks");

    if (columnError) {
      console.error("❌ Error getting column info:", columnError);
      return {
        status: "error",
        message: `Error getting column info: ${columnError.message}`,
      };
    }

    // Find embedding column details
    const embeddingColumn = columnInfo?.find(
      (c) => c.column_name === "embedding",
    );

    console.log("📋 Column info:", {
      embeddingColumn,
      allColumns: columnInfo?.map(
        (c) => `${c.column_name} (${c.data_type || c.udt_name})`,
      ),
    });

    // Get a sample row to check embedding format
    const { data: sampleRow, error: sampleError } = await supabaseClient
      .from("pdf_chunks")
      .select("id, embedding")
      .limit(1)
      .single();

    if (sampleError) {
      console.error("❌ Error getting sample row:", sampleError);
      return {
        status: "error",
        message: `Error getting sample row: ${sampleError.message}`,
      };
    }

    if (!sampleRow) {
      return {
        status: "warning",
        message: "No rows found in pdf_chunks table",
      };
    }

    // Check embedding format
    console.log("📋 Embedding sample:");

    const embedding = sampleRow.embedding;
    const embeddingType = typeof embedding;
    let embeddingDetails = "Unknown format";

    if (embeddingType === "string") {
      embeddingDetails = `String of length ${embedding.length}`;

      // Check if it's a JSON string
      try {
        const parsed = JSON.parse(embedding);
        embeddingDetails += `, parses as ${Array.isArray(parsed) ? "array" : typeof parsed} with ${Array.isArray(parsed) ? parsed.length : "N/A"} elements`;
      } catch {
        embeddingDetails += ", not a valid JSON string";
      }
    } else if (embeddingType === "object") {
      if (Array.isArray(embedding)) {
        embeddingDetails = `Array with ${embedding.length} elements`;
      } else if (embedding === null) {
        embeddingDetails = "null value";
      } else {
        embeddingDetails = `Object with keys: ${Object.keys(embedding).join(", ")}`;
      }
    } else {
      embeddingDetails = `${embeddingType} value`;
    }

    // Try raw SQL query to see the raw format
    let sqlFormat = "Unknown";
    try {
      const { data: sqlResult, error: sqlError } = await supabaseClient.rpc(
        "raw_embedding_check",
        { row_id: sampleRow.id },
      );

      if (!sqlError && sqlResult) {
        sqlFormat = `SQL reports: ${sqlResult}`;
      }
    } catch (e) {
      sqlFormat = `Error checking SQL format: ${e instanceof Error ? e.message : String(e)}`;
    }

    // Check vector operations
    console.log("🧪 Testing vector operations...");
    let vectorOpsResult = "Unknown";

    try {
      // Try to create a simple query that tests if vector operations work
      const { data: vectorTest, error: vectorError } = await supabaseClient.rpc(
        "test_vector_operation",
        { row_id: sampleRow.id },
      );

      if (vectorError) {
        vectorOpsResult = `Error: ${vectorError.message}`;
      } else {
        vectorOpsResult = `Success: ${JSON.stringify(vectorTest)}`;
      }
    } catch (e) {
      vectorOpsResult = `Exception: ${e instanceof Error ? e.message : String(e)}`;
    }

    return {
      status: "success",
      message: `Embedding column inspection: Type: ${embeddingColumn?.data_type || embeddingColumn?.udt_name || "unknown"}, Format: ${embeddingDetails}, SQL: ${sqlFormat}, Vector ops: ${vectorOpsResult}`,
      data: {
        columnInfo,
        embeddingColumn,
        sampleEmbedding: {
          type: embeddingType,
          details: embeddingDetails,
        },
      },
    };
  } catch (error) {
    console.error("❌ Error inspecting embedding format:", error);
    return {
      status: "error",
      message: `Error inspecting embedding format: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
