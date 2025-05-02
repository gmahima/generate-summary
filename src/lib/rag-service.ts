"use server";

// =========================================================
// Importing required dependencies
// =========================================================

// Document loading and processing
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";

// Vector storage and embedding
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
// Using Jina embeddings instead of OpenAI
import { JinaEmbeddings } from "@langchain/community/embeddings/jina";

// LLM and prompting
import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";

// Database connectivity
// NOTE: You need to install this package: npm install @supabase/supabase-js
import { createClient } from "@supabase/supabase-js";

// File system operations
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// Application constants
import { TEMPORARY_USER_ID } from "@/lib/constants";

// =========================================================
// Environment and Client Configuration
// =========================================================

/**
 * Initialize the Supabase client for database operations
 * These environment variables should be set in your .env file:
 * - NEXT_PUBLIC_SUPABASE_URL: The URL of your Supabase instance
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for admin database access
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

// Create a Supabase client with admin privileges for database operations
const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

// Hard-coded user ID is now imported from constants.ts

/**
 * Initialize Jina embeddings with API key
 * The JINA_API_KEY should be set in your .env file
 */
const createEmbeddings = () => {
  return new JinaEmbeddings({
    apiKey: process.env.JINA_API_KEY as string,
    model: "jina-embeddings-v3", // Using Jina's latest embedding model with 1024 dimensions
  });
};

// =========================================================
// PDF Processing and Storage Functions
// =========================================================

/**
 * Process and store a PDF document in Supabase with vector embeddings
 *
 * This function performs the following operations:
 * 1. Extracts text from the uploaded PDF
 * 2. Stores the full document in the 'pdfs' table
 * 3. Splits the document into chunks
 * 4. Generates embeddings for each chunk using Jina
 * 5. Stores chunks and embeddings in the 'pdf_chunks' table
 * 6. Generates a summary of the document (optional)
 *
 * @param formData - Form data containing the PDF file
 * @returns Object with PDF ID and optional summary
 */
export async function processPdf(formData: FormData): Promise<{
  pdfId: string;
  summary: string | null;
}> {
  console.log("🚀 Starting PDF processing for RAG with Jina embeddings");

  // =========================================================
  // Step 1: Extract data from form and validate
  // =========================================================

  // Get the file from the form data
  const file = formData.get("file") as File;
  // Using the constant user ID instead of getting from form data
  const userId = TEMPORARY_USER_ID;

  // Validate required inputs
  if (!file) {
    console.error("❌ No file provided in the form data");
    throw new Error("No file provided");
  }

  console.log(
    `📄 Processing file: ${file.name}, Size: ${(file.size / 1024).toFixed(
      2,
    )} KB, Type: ${file.type}`,
  );

  // =========================================================
  // Step 2: Create temporary file for PDF processing
  // =========================================================

  // Create a temporary file for the PDF (LangChain's PDFLoader requires a file path)
  const tempDir = os.tmpdir();
  const tempFilePath = path.join(tempDir, `pdf-${Date.now()}.pdf`);

  try {
    // =========================================================
    // Step 3: Convert File object to buffer and save to disk
    // =========================================================

    console.log("📥 Converting file to buffer...");
    const fileBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(fileBuffer);
    console.log(`✅ Converted to buffer of size: ${buffer.length} bytes`);

    console.log(`💾 Writing PDF data to temporary file: ${tempFilePath}`);
    fs.writeFileSync(tempFilePath, buffer);
    console.log("✅ Temporary file created");

    // =========================================================
    // Step 4: Extract text from the PDF
    // =========================================================

    console.log("📚 Loading and parsing PDF content...");
    // Use LangChain's PDFLoader to extract text from the PDF
    const loader = new PDFLoader(tempFilePath);
    const docs = await loader.load();
    console.log(`📄 Loaded ${docs.length} pages from PDF`);

    if (docs.length === 0) {
      console.warn("⚠️ No content extracted from PDF");
      throw new Error(
        "Could not extract any content from the provided PDF file.",
      );
    }

    // Join all document content for storing in the pdfs table
    const fullText = docs.map((doc) => doc.pageContent).join("\n\n");

    // =========================================================
    // Step 5: Store the document in the database
    // =========================================================

    console.log("💾 Storing document in 'pdfs' table...");
    const { data: pdfData, error: pdfError } = await supabaseClient
      .from("pdfs")
      .insert({
        name: file.name,
        content: fullText,
        user_id: userId,
      })
      .select()
      .single();

    if (pdfError) {
      console.error("❌ Error storing document:", pdfError);
      throw new Error(`Failed to store document: ${pdfError.message}`);
    }

    console.log(`✅ Document stored with ID: ${pdfData.id}`);

    // =========================================================
    // Step 6: Split the document into smaller chunks for vectorization
    // =========================================================

    console.log("✂️ Splitting document into chunks...");
    // Use RecursiveCharacterTextSplitter to break text into manageable chunks
    // - chunkSize: The target size of each chunk in characters
    // - chunkOverlap: The number of characters to overlap between chunks for context continuity
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000, // 1000 characters per chunk
      chunkOverlap: 200, // 200 character overlap between chunks
    });

    // Add metadata to each chunk including the PDF ID and user ID
    // This allows for filtering queries by document and owner
    const chunkedDocs = await textSplitter.splitDocuments(
      docs.map((doc) => {
        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            pdf_id: pdfData.id,
            user_id: userId,
          },
        });
      }),
    );

    console.log(`🧩 Split document into ${chunkedDocs.length} chunks`);

    // Let's verify the metadata is correctly set
    if (chunkedDocs.length > 0) {
      console.log(
        "🔍 Checking first chunk metadata:",
        JSON.stringify(chunkedDocs[0].metadata),
      );
    }

    // =========================================================
    // Step 7: Generate embeddings and store in vector database
    // =========================================================

    console.log("🧠 Generating Jina embeddings and storing in vector store...");
    // Initialize Jina embeddings
    const embeddings = createEmbeddings();

    // Store documents with embeddings in Supabase
    // This creates an embedding for each chunk and stores both the text and embedding
    console.log(
      `🧠 Storing ${chunkedDocs.length} document chunks with embeddings in Supabase...`,
    );

    try {
      // Create a proper stringified version of the metadata
      // This is crucial to ensure the pdf_id is properly stored as a string
      const preparedDocs = chunkedDocs.map((doc) => {
        // Make sure all metadata values are properly stringified for storage
        const preparedMetadata = Object.entries(doc.metadata).reduce(
          (acc, [key, value]) => {
            // Ensure values are always stored as strings
            acc[key] = String(value);
            return acc;
          },
          {} as Record<string, string>,
        );

        // Create a new Document with properly stringified metadata
        return new Document({
          pageContent: doc.pageContent,
          metadata: preparedMetadata,
        });
      });

      // Print debug info for the first document
      if (preparedDocs.length > 0) {
        console.log(
          "📋 Prepared Document metadata:",
          JSON.stringify(preparedDocs[0].metadata),
        );
        console.log(
          "📤 PDF ID value in metadata:",
          preparedDocs[0].metadata.pdf_id,
        );
        console.log("📤 PDF ID type:", typeof preparedDocs[0].metadata.pdf_id);
      }

      console.log("📊 Creating document embeddings with Jina API...");

      // Store in the vector database - reusing the same table as PDF chunks
      await SupabaseVectorStore.fromDocuments(preparedDocs, embeddings, {
        client: supabaseClient,
        tableName: "pdf_chunks",
        queryName: "match_pdf_chunks",
      });

      // After storing, verify if chunks are properly stored with metadata
      const { count, error } = await supabaseClient
        .from("pdf_chunks")
        .select("*", { count: "exact", head: true })
        .filter("metadata->>pdf_id", "eq", pdfData.id);

      console.log(
        `📊 Verification: Found ${count || 0} chunks in database for content ID ${pdfData.id}`,
      );
      if (error) {
        console.error("❌ Error verifying chunks:", error);
      }

      // Don't return vectorStore here - we'll return the proper object later
    } catch (storeError) {
      console.error("❌ Error storing chunks with embeddings:", storeError);
      throw new Error(
        `Failed to store document chunks: ${storeError instanceof Error ? storeError.message : "Unknown error"}`,
      );
    }

    // =========================================================
    // Step 8: Generate a summary of the document (optional)
    // =========================================================

    let summary = null;
    try {
      console.log("📝 Generating document summary...");
      summary = await generateSummaryFromText(fullText);
      console.log("✅ Summary generated");
    } catch (summaryError) {
      console.warn("⚠️ Failed to generate summary:", summaryError);
      // Continue without summary - this is not critical functionality
    }

    // =========================================================
    // Step 9: Clean up temporary files
    // =========================================================

    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log("✅ Temporary file removed");
    }

    return {
      pdfId: pdfData.id,
      summary,
    };
  } catch (error) {
    console.error("❌ Error processing PDF:", error);

    // Clean up temporary file in case of error
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (cleanupError) {
      console.error("Error cleaning up temporary file:", cleanupError);
    }

    throw error;
  }
}

/**
 * Process and store a web page in Supabase with vector embeddings
 *
 * This function performs the following operations:
 * 1. Extracts text from the provided URL
 * 2. Stores the content in the 'pdfs' table (reusing the same table)
 * 3. Splits the document into chunks
 * 4. Generates embeddings for each chunk using Jina
 * 5. Stores chunks and embeddings in the 'pdf_chunks' table
 * 6. Returns a content ID for chat and a summary (optional)
 *
 * @param formData - Form data containing the URL
 * @returns Object with content ID and optional summary
 */
export async function processLink(formData: FormData): Promise<{
  contentId: string;
  summary: string | null;
}> {
  console.log("🚀 Starting URL processing for RAG with Jina embeddings");

  // =========================================================
  // Step 1: Extract data from form and validate
  // =========================================================

  // Get the URL from the form data
  const url = formData.get("url") as string;
  // Using the constant user ID
  const userId = (formData.get("userId") as string) || TEMPORARY_USER_ID;

  // Validate required inputs
  if (!url) {
    console.error("❌ No URL provided in the form data");
    throw new Error("No URL provided");
  }

  console.log(`🔗 Processing URL: ${url}`);

  try {
    // =========================================================
    // Step 2: Extract text from the URL
    // =========================================================

    console.log("📚 Loading and parsing web page content...");

    // Use CheerioWebBaseLoader to extract text from the web page
    const loader = new CheerioWebBaseLoader(url);
    const docs = await loader.load();

    console.log(`📄 Loaded content from URL: ${url}`);

    if (docs.length === 0) {
      console.warn("⚠️ No content extracted from URL");
      throw new Error("Could not extract any content from the provided URL.");
    }

    // Join all document content for storing in the pdfs table
    // Reusing the same table for both PDFs and links
    const fullText = docs.map((doc) => doc.pageContent).join("\n\n");

    // =========================================================
    // Step 3: Store the document in the database
    // =========================================================

    console.log("💾 Storing web content in 'pdfs' table...");
    const { data: pdfData, error: pdfError } = await supabaseClient
      .from("pdfs")
      .insert({
        name: url,
        content: fullText,
        user_id: userId,
      })
      .select()
      .single();

    if (pdfError) {
      console.error("❌ Error storing document:", pdfError);
      throw new Error(`Failed to store document: ${pdfError.message}`);
    }

    console.log(`✅ Web content stored with ID: ${pdfData.id}`);

    // =========================================================
    // Step 4: Split the document into smaller chunks for vectorization
    // =========================================================

    console.log("✂️ Splitting document into chunks...");
    // Use RecursiveCharacterTextSplitter to break text into manageable chunks
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000, // 1000 characters per chunk
      chunkOverlap: 200, // 200 character overlap between chunks
    });

    // Add metadata to each chunk including the content ID and user ID
    const chunkedDocs = await textSplitter.splitDocuments(
      docs.map((doc) => {
        return new Document({
          pageContent: doc.pageContent,
          metadata: {
            ...doc.metadata,
            pdf_id: pdfData.id,
            user_id: userId,
            source_type: "link",
            source: url,
          },
        });
      }),
    );

    console.log(`🧩 Split content into ${chunkedDocs.length} chunks`);

    // Let's verify the metadata is correctly set before processing
    if (chunkedDocs.length > 0) {
      console.log(
        "🔍 Checking first chunk metadata before vector storage:",
        JSON.stringify(chunkedDocs[0].metadata),
      );
    }

    // =========================================================
    // Step 5: Generate embeddings and store in vector database
    // =========================================================

    console.log("🧠 Generating Jina embeddings and storing in vector store...");
    // Initialize Jina embeddings
    const embeddings = createEmbeddings();

    console.log(
      `🧠 Storing ${chunkedDocs.length} content chunks with embeddings in Supabase...`,
    );

    try {
      // Create a proper stringified version of the metadata
      // This is crucial to ensure the pdf_id is properly stored as a string
      const preparedDocs = chunkedDocs.map((doc) => {
        // Make sure all metadata values are properly stringified for storage
        const preparedMetadata = Object.entries(doc.metadata).reduce(
          (acc, [key, value]) => {
            // Ensure values are always stored as strings
            acc[key] = String(value);
            return acc;
          },
          {} as Record<string, string>,
        );

        // Create a new Document with properly stringified metadata
        return new Document({
          pageContent: doc.pageContent,
          metadata: preparedMetadata,
        });
      });

      // Print debug info for the first document
      if (preparedDocs.length > 0) {
        console.log(
          "📋 Prepared Document metadata:",
          JSON.stringify(preparedDocs[0].metadata),
        );
        console.log(
          "📤 PDF ID value in metadata:",
          preparedDocs[0].metadata.pdf_id,
        );
        console.log("📤 PDF ID type:", typeof preparedDocs[0].metadata.pdf_id);
      }

      console.log("📊 Creating document embeddings with Jina API...");

      // Store in the vector database - reusing the same table as PDF chunks
      await SupabaseVectorStore.fromDocuments(preparedDocs, embeddings, {
        client: supabaseClient,
        tableName: "pdf_chunks",
        queryName: "match_pdf_chunks",
      });

      // After storing, check what actually got stored in the database
      const { data: storedChunks, error: fetchError } = await supabaseClient
        .from("pdf_chunks")
        .select("content, metadata")
        .filter("metadata->>pdf_id", "eq", pdfData.id)
        .limit(1);

      if (fetchError) {
        console.error("❌ Error fetching stored chunks:", fetchError);
      } else {
        console.log("📊 Stored chunks check:");
        console.log(
          `📚 Found ${storedChunks.length} chunks with pdf_id=${pdfData.id}`,
        );

        if (storedChunks.length > 0) {
          console.log(
            "📑 First stored chunk metadata:",
            JSON.stringify(storedChunks[0].metadata),
          );
        } else {
          // Try a more general query to see what metadata looks like
          const { data: anyChunks, error } = await supabaseClient
            .from("pdf_chunks")
            .select("content, metadata")
            .eq("id", pdfData.id) // Try finding by ID directly
            .limit(1);

          if (error) {
            console.error("❌ Error fetching any chunks:", error);
          } else if (anyChunks.length > 0) {
            console.log("📊 Found a chunk with matching ID directly");
            console.log(
              "📑 Chunk metadata:",
              JSON.stringify(anyChunks[0].metadata),
            );
          } else {
            // Get the most recent chunks to check for any issues
            await checkLatestChunkMetadata();
          }
        }
      }

      // For now, return without a summary - can be generated separately
      return {
        contentId: pdfData.id,
        summary: null,
      };
    } catch (error) {
      console.error("❌ Error generating embeddings:", error);
      throw new Error(
        `Failed to generate embeddings: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  } catch (error) {
    console.error("❌ Error processing URL:", error);
    throw new Error(
      `Failed to process URL: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

/**
 * Check the most recently created chunk's metadata
 * This function helps diagnose issues with metadata storage
 */
export async function checkLatestChunkMetadata() {
  console.log("🔍 Checking the most recently created chunk's metadata...");

  try {
    const { data: latestChunks, error } = await supabaseClient
      .from("pdf_chunks")
      .select("id, content, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("❌ Error fetching latest chunks:", error);
      return;
    }

    if (!latestChunks || latestChunks.length === 0) {
      console.log("⚠️ No chunks found in the database at all");
      return;
    }

    console.log(`📊 Found ${latestChunks.length} recent chunks to analyze`);

    // Check each chunk for proper metadata
    latestChunks.forEach((chunk, index) => {
      console.log(`\n📄 CHUNK #${index + 1} (ID: ${chunk.id}):`);
      console.log(`📅 Created at: ${chunk.created_at}`);
      console.log(`📋 Metadata: ${JSON.stringify(chunk.metadata)}`);

      // Check if pdf_id exists and has a value
      if (!chunk.metadata) {
        console.error("❌ ERROR: Metadata is null or undefined!");
      } else if (
        chunk.metadata.pdf_id === undefined ||
        chunk.metadata.pdf_id === null
      ) {
        console.error("❌ ERROR: pdf_id is missing from metadata!");
      } else if (
        chunk.metadata.pdf_id === "0" ||
        chunk.metadata.pdf_id === 0 ||
        chunk.metadata.pdf_id === ""
      ) {
        console.error(
          `❌ ERROR: pdf_id has an invalid value: ${chunk.metadata.pdf_id}`,
        );
      } else {
        console.log(`✅ pdf_id looks good: ${chunk.metadata.pdf_id}`);
      }

      // First 50 chars of content
      console.log(`📝 Content preview: ${chunk.content.substring(0, 50)}...`);
    });

    return latestChunks;
  } catch (e) {
    console.error("❌ Error in checkLatestChunkMetadata:", e);
    return null;
  }
}

// =========================================================
// RAG (Retrieval Augmented Generation) Query Function
// =========================================================

/**
 * Query a PDF document using Retrieval Augmented Generation (RAG)
 *
 * This function implements the RAG pattern:
 * 1. Takes a user query and document ID
 * 2. Converts the query to an embedding using Jina
 * 3. Retrieves the most similar chunks from the document
 * 4. Sends the chunks + query to the Groq LLM to generate an answer
 * 5. Stores the interaction in the chat history
 *
 * @param formData - Form data containing query and PDF ID
 * @returns Object containing the generated answer
 */
export async function queryDocument(formData: FormData): Promise<{
  answer: string;
}> {
  console.log("🤖 Starting RAG query process with Jina embeddings");

  // Extract required inputs
  const query = formData.get("query") as string;
  const pdfId = formData.get("pdfId") as string;
  const userId = (formData.get("userId") as string) || TEMPORARY_USER_ID;
  const contentType = (formData.get("contentType") as "pdf" | "link") || "pdf";

  // Validate required inputs
  if (!query) {
    console.error("❌ No query provided in form data");
    throw new Error("No query provided");
  }

  if (!pdfId) {
    console.error("❌ No content ID provided in form data");
    throw new Error("No content ID provided");
  }

  console.log(`📝 Query: "${query}"`);
  console.log(`🔑 Content ID: ${pdfId}`);
  console.log(`👤 User ID: ${userId}`);
  console.log(`📁 Content Type: ${contentType}`);

  try {
    console.log(`🔍 Processing query: "${query}" for document ID: ${pdfId}`);

    // =========================================================
    // Step 2: Check if we have document chunks for this PDF
    // =========================================================

    // Check if we have any document chunks for this PDF directly with SQL
    console.log("🔍 Checking for document chunks in database...");
    const { count, error } = await supabaseClient
      .from("pdf_chunks")
      .select("*", { count: "exact", head: true })
      .filter("metadata->>pdf_id", "eq", pdfId);

    console.log(
      `📊 Found ${count || 0} chunks in database for PDF ID: ${pdfId}`,
    );

    if (error) {
      console.error("❌ Error checking document chunks:", error);
      throw new Error(
        `Database error when checking for chunks: ${error.message}`,
      );
    }

    if (count === 0) {
      console.warn(
        "⚠️ No chunks found for this PDF. The document may not have been properly processed.",
      );
      return {
        answer:
          "I couldn't find any information for this document in my database. The document may not have been properly processed.",
      };
    }

    // =========================================================
    // Step 3: Initialize vector store and run similarity search
    // =========================================================

    console.log("🧠 Initializing vector store for similarity search...");
    // Create embeddings model
    const embeddings = createEmbeddings();

    // No longer need vectorStore initialization since we're using direct queries

    // =========================================================
    // Step 4: Create the prompt template for RAG
    // =========================================================

    // Create a more specific prompt that mentions the content type
    const prompt = PromptTemplate.fromTemplate(`
      You are an AI assistant for answering questions about ${contentType === "pdf" ? "documents" : "web pages"}.
      
      Use the following pieces of context to answer the question at the end.
      If you don't know the answer, just say that you don't know, don't try to make up an answer.
      Provide a conversational response that directly answers the question.
      
      Context:
      {context}
      
      Question: {question}
      
      Helpful Answer:
    `);

    // =========================================================
    // Step 5: Set up the LLM and create the RAG chain
    // =========================================================

    // Initialize the Groq model
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY as string,
      model: "llama-3.1-8b-instant", // Using Llama 3 for inference
      temperature: 0, // Use 0 for more deterministic responses
    });

    console.log("🔎 Performing direct vector similarity search with query...");

    // Convert user query to embedding vector
    const queryEmbedding = await embeddings.embedQuery(query);
    console.log("✅ Generated query embedding vector");

    // Define type for query results
    interface ChunkResult {
      id: string;
      content: string;
      metadata: Record<string, unknown>;
    }

    // Run direct vector similarity search using pgvector's <=> operator
    // Note: We use a raw query since the bind() method might not be supported in all versions
    console.log(`🔍 Using filter parameters: pdfId=${pdfId}`);

    // First check direct database access
    const { count: directCount, error: directCountError } = await supabaseClient
      .from("pdf_chunks")
      .select("*", { count: "exact", head: true })
      .filter("metadata->pdf_id", "eq", pdfId);

    console.log(
      `📊 Direct database count: ${directCount || 0} chunks for pdfId=${pdfId}`,
    );

    if (directCountError) {
      console.error("❌ Error in direct count:", directCountError);

      // Try alternative filter approach
      const { count: alternativeCount, error: alternativeError } =
        await supabaseClient
          .from("pdf_chunks")
          .select("*", { count: "exact", head: true })
          .filter("metadata->>pdf_id", "eq", pdfId);

      console.log(
        `📊 Alternative query count: ${alternativeCount || 0} chunks for pdfId=${pdfId}`,
      );

      if (alternativeError) {
        console.error("❌ Error in alternative count:", alternativeError);
      }
    }

    // Now try with the RPC function
    const { data: vectorResults, error: vectorError } =
      await supabaseClient.rpc("match_pdf_chunks", {
        query_vector: queryEmbedding,
        pdf_id_filter: pdfId,
        match_limit: 5,
      });

    if (vectorError) {
      console.error("❌ Error performing vector search:", vectorError);
      throw new Error(`Vector search failed: ${vectorError.message}`);
    }

    console.log(
      `✅ Vector search completed, found ${vectorResults?.length || 0} results`,
    );

    // Convert results to Document objects
    const retrievedDocs = (vectorResults || []).map(
      (chunk: ChunkResult) =>
        new Document({
          pageContent: chunk.content,
          metadata: chunk.metadata,
        }),
    );

    if (retrievedDocs.length === 0) {
      console.log(
        "⚠️ No matching documents found! Retrieving a few chunks directly as fallback...",
      );

      // Fallback: Get a few chunks directly if similarity search returns nothing
      const { data: fallbackChunks, error: fallbackError } =
        await supabaseClient
          .from("pdf_chunks")
          .select("content, metadata")
          .filter("metadata->pdf_id", "eq", pdfId)
          .limit(3);

      if (fallbackError) {
        console.error("❌ Error retrieving fallback chunks:", fallbackError);

        // Try alternative filter approach
        const {
          data: alternativeFallbackChunks,
          error: alternativeFallbackError,
        } = await supabaseClient
          .from("pdf_chunks")
          .select("content, metadata")
          .filter("metadata->>pdf_id", "eq", pdfId)
          .limit(3);

        if (alternativeFallbackError) {
          console.error(
            "❌ Error in alternative fallback:",
            alternativeFallbackError,
          );
        } else if (
          alternativeFallbackChunks &&
          alternativeFallbackChunks.length > 0
        ) {
          console.log(
            `✅ Retrieved ${alternativeFallbackChunks.length} alternative fallback chunks`,
          );

          // Convert to Document format
          const fallbackDocs = alternativeFallbackChunks.map(
            (chunk) =>
              new Document({
                pageContent: chunk.content,
                metadata: chunk.metadata,
              }),
          );

          // Use the fallback chunks instead
          return await processDocsAndGenerateAnswer(
            fallbackDocs,
            query,
            pdfId,
            userId,
            prompt,
            model,
          );
        }
      } else if (fallbackChunks && fallbackChunks.length > 0) {
        console.log(`✅ Retrieved ${fallbackChunks.length} fallback chunks`);

        // Convert to Document format
        const fallbackDocs = fallbackChunks.map(
          (chunk) =>
            new Document({
              pageContent: chunk.content,
              metadata: chunk.metadata,
            }),
        );

        // Use the fallback chunks instead
        return await processDocsAndGenerateAnswer(
          fallbackDocs,
          query,
          pdfId,
          userId,
          prompt,
          model,
        );
      }
    }

    // Log a sample of retrieved content
    if (retrievedDocs.length > 0) {
      console.log(
        "📄 Sample retrieved content:",
        retrievedDocs[0].pageContent.substring(0, 100) + "...",
      );
    }

    // =========================================================
    // Step 6: Execute the RAG chain to generate an answer
    // =========================================================

    console.log("🤖 Executing RAG chain with Groq LLM...");

    // Process the docs and generate an answer
    return await processDocsAndGenerateAnswer(
      retrievedDocs,
      query,
      pdfId,
      userId,
      prompt,
      model,
    );
  } catch (error) {
    console.error("❌ Error querying document:", error);
    throw error;
  }
}

// =========================================================
// Helper Functions
// =========================================================

/**
 * Generate a summary from document text using Groq LLM
 *
 * This function:
 * 1. Takes the full text of a document
 * 2. Creates a prompt asking for a comprehensive summary
 * 3. Sends the prompt to Groq LLM
 * 4. Returns the generated summary
 *
 * @param text - The full text content to summarize
 * @returns A string containing the generated summary
 */
async function generateSummaryFromText(text: string): Promise<string> {
  // Initialize the Groq model for summary generation
  const model = new ChatGroq({
    apiKey: process.env.GROQ_API_KEY as string,
    model: "llama-3.1-8b-instant", // Using Llama 3 for summaries
    temperature: 0, // Lower temperature for more factual summaries
  });

  // Create a prompt template for document summarization
  const summaryPrompt = PromptTemplate.fromTemplate(`
    You are a professional document summarizer.
    
    Below is the content from a document. Please create a comprehensive summary 
    that captures the key points, main arguments, and conclusions. The summary should be 
    well-structured, clear, and concise while preserving the important details.
    
    Document content:
    {text}
    
    Summary:
  `);

  // Create and execute a chain for summary generation
  const chain = RunnableSequence.from([
    {
      invoke: async (input: { text: string }) => {
        console.log(
          "📄 Document text sample being passed to LLM:",
          input.text.substring(0, 200) + "...",
        );
        return summaryPrompt.format(input);
      },
    },
    model,
    new StringOutputParser(),
  ]);

  // Invoke the chain with the document text
  // Limit to 32,000 characters to prevent token overflow
  const summary = await chain.invoke({
    text: text.substring(0, 32000),
  });

  return summary;
}

// =========================================================
// PDF Retrieval Function
// =========================================================

/**
 * Fetch previously uploaded PDFs for the current user
 *
 * This function retrieves all PDFs that have been uploaded by the current user
 * so they can be loaded for chat without re-embedding.
 *
 * @returns Array of PDF objects with id, name, and creation date
 */
export async function fetchUserPdfs(): Promise<
  Array<{
    id: string;
    name: string;
    created_at: string;
  }>
> {
  console.log("📚 Fetching user PDFs");

  try {
    // Query the database for PDFs belonging to the current user
    const { data: pdfs, error } = await supabaseClient
      .from("pdfs")
      .select("id, name, created_at")
      .eq("user_id", TEMPORARY_USER_ID)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("❌ Error fetching PDFs:", error);
      throw new Error(`Failed to fetch PDFs: ${error.message}`);
    }

    console.log(`✅ Found ${pdfs.length} PDFs for user`);
    return pdfs;
  } catch (error) {
    console.error("❌ Error in fetchUserPdfs:", error);
    throw error;
  }
}

/**
 * Process retrieved documents and generate an answer using the LLM
 */
async function processDocsAndGenerateAnswer(
  docs: Document[],
  query: string,
  pdfId: string,
  userId: string,
  prompt: PromptTemplate,
  model: ChatGroq,
): Promise<{ answer: string }> {
  // Build context from retrieved documents
  const context = docs.map((doc: Document) => doc.pageContent).join("\n\n");

  // Format the full prompt for debugging
  const formattedPrompt = await prompt.format({
    context,
    question: query,
  });
  console.log(
    "📝 Formatted prompt sample:",
    formattedPrompt.substring(0, 200) + "...",
  );

  // Execute the chain with the formatted input
  let answer;

  if (docs.length === 0) {
    answer =
      "I don't have any information about your document. No relevant content was found in the database.";
  } else {
    // Use the model directly with our formatted prompt instead of the chain
    const response = await model.invoke(formattedPrompt);
    answer = response.content.toString();
  }

  console.log("✅ Generated response using RAG");

  // =========================================================
  // Step 7: Store the conversation in chat history
  // =========================================================

  console.log("💾 Storing conversation in chat history...");
  await supabaseClient.from("chat_history").insert({
    pdf_id: pdfId,
    user_id: userId,
    user_message: query,
    assistant_message: answer,
  });

  return { answer };
}
