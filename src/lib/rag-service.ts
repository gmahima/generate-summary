"use server";

// =========================================================
// Importing required dependencies
// =========================================================

// Document loading and processing
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";

// Vector storage and embedding
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
// Using Jina embeddings instead of OpenAI
import { JinaEmbeddings } from "@langchain/community/embeddings/jina";

// LLM and prompting
import { ChatGroq } from "@langchain/groq";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  RunnableSequence,
  RunnablePassthrough,
} from "@langchain/core/runnables";

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

    // =========================================================
    // Step 7: Generate embeddings and store in vector database
    // =========================================================

    console.log("🧠 Generating Jina embeddings and storing in vector store...");
    // Initialize Jina embeddings
    const embeddings = createEmbeddings();

    // Store documents with embeddings in Supabase
    // This creates an embedding for each chunk and stores both the text and embedding
    await SupabaseVectorStore.fromDocuments(chunkedDocs, embeddings, {
      client: supabaseClient,
      tableName: "pdf_chunks",
      queryName: "match_documents",
    });

    console.log("✅ Document processed and stored with embeddings");

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
  console.log("🔍 Starting document query with Jina-powered RAG");

  // =========================================================
  // Step 1: Extract and validate query parameters
  // =========================================================

  // Get query and document ID from form data
  const query = formData.get("query") as string;
  const pdfId = formData.get("pdfId") as string;
  // Using the constant user ID instead of getting from form data
  const userId = TEMPORARY_USER_ID;

  // Validate required inputs
  if (!query) {
    console.error("❌ No query provided");
    throw new Error("No query provided");
  }

  if (!pdfId) {
    console.error("❌ No PDF ID provided");
    throw new Error("No PDF ID provided");
  }

  try {
    console.log(`🔍 Processing query: "${query}" for document ID: ${pdfId}`);

    // =========================================================
    // Step 2: Initialize vector store with Jina embeddings
    // =========================================================

    // Create a vector store instance with Jina embeddings
    const embeddings = createEmbeddings();
    const vectorStore = new SupabaseVectorStore(embeddings, {
      client: supabaseClient,
      tableName: "pdf_chunks",
      queryName: "match_documents",
      filter: {
        pdf_id: pdfId,
      },
    });

    // =========================================================
    // Step 3: Configure and create the retriever
    // =========================================================

    console.log("🔎 Retrieving relevant document chunks...");
    // Create a retriever to fetch similar documents
    const retriever = vectorStore.asRetriever({
      // Specify retrieval parameters
      searchType: "similarity", // Use similarity search (cosine similarity)
      k: 5, // Number of chunks to retrieve
      filter: {
        pdf_id: pdfId, // Only search within the specified document
      },
    });

    // =========================================================
    // Step 4: Create the prompt template for RAG
    // =========================================================

    // Create a prompt template that combines context and user question
    const prompt = PromptTemplate.fromTemplate(`
      You are an AI assistant for answering questions about documents.
      Use the following pieces of context to answer the question at the end.
      If you don't know the answer, just say that you don't know, don't try to make up an answer.
      Keep your answers concise and helpful.
      
      Context:
      {context}
      
      Question: {question}
      
      Answer:
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

    // Build the RAG chain using LangChain's RunnableSequence
    // This defines the execution pipeline for the RAG process
    const chain = RunnableSequence.from([
      {
        // First, fetch relevant contexts
        context: retriever.pipe((docs) => {
          // Join all retrieved document chunks into a single context string
          return docs.map((doc) => doc.pageContent).join("\n\n");
        }),
        // Pass through the original question
        question: new RunnablePassthrough(),
      },
      // Apply the prompt template to format inputs
      prompt,
      // Send to the LLM
      model,
      // Extract the string output
      new StringOutputParser(),
    ]);

    // =========================================================
    // Step 6: Execute the RAG chain to generate an answer
    // =========================================================

    console.log("🤖 Executing RAG chain with Groq LLM...");
    const answer = await chain.invoke(query);
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
    summaryPrompt,
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
