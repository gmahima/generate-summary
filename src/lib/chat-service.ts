"use server";

// Import the RAG query function from our RAG service
import { queryDocument } from "./rag-service";

/**
 * Content Query Service
 *
 * This service provides an interface for querying content (PDFs or web pages) using
 * Retrieval Augmented Generation (RAG). It acts as a wrapper around
 * the core RAG implementation, providing error handling and logging.
 *
 * The RAG process involves:
 * 1. Taking a natural language query about a document
 * 2. Retrieving relevant chunks from the document using embeddings
 * 3. Using those chunks to generate a contextually accurate response
 *
 * Error handling ensures that users receive graceful error messages
 * instead of technical errors.
 */

/**
 * Query a document using RAG (Retrieval-Augmented Generation)
 *
 * @param formData - Form data containing:
 *   - query: The user's question
 *   - pdfId: The ID of the content to query (could be PDF or web page content)
 *   - userId: The ID of the user making the query
 *   - contentType: The type of content (pdf or link)
 * @returns Object containing the answer to the query
 */
export async function queryPdfDocument(
  formData: FormData,
): Promise<{ answer: string }> {
  console.log("🤖 Starting content query process with RAG");

  try {
    // Log the values we're receiving
    const query = formData.get("query");
    const pdfId = formData.get("pdfId");
    const contentType = formData.get("contentType") || "pdf";

    console.log(`📝 Query: "${query}"`);
    console.log(`🔑 Content ID: ${pdfId}`);
    console.log(`📁 Content Type: ${contentType}`);

    // Forward the request to our RAG implementation in rag-service.ts
    // This will:
    // 1. Convert the query to an embedding using Jina
    // 2. Find relevant document chunks in Supabase
    // 3. Generate a response using Groq LLM
    try {
      return await queryDocument(formData);
    } catch (ragError) {
      console.error("❌ Error in queryDocument function:", ragError);
      console.error("Error details:", JSON.stringify(ragError, null, 2));
      throw ragError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    // Log the error for debugging
    console.error("❌ Error querying document:", error);
    console.error(
      "Stack trace:",
      error instanceof Error ? error.stack : "No stack trace",
    );

    // Return a user-friendly error message
    return {
      answer: `Sorry, I encountered an error while processing your query: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Please try again later or contact support if the issue persists.`,
    };
  }
}
