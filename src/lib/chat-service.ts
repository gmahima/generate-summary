"use server";

// Import the RAG query function from our RAG service
import { queryDocument } from "./rag-service";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { AgentExecutor, createStructuredChatAgent } from "langchain/agents";
import { Calculator } from "@langchain/community/tools/calculator";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

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
 * Create and initialize the calculator agent
 *
 * This function creates an agent with a calculator tool that can solve
 * arithmetic expressions. The agent will automatically decide when to use
 * the calculator tool based on the query content.
 */
async function createCalculatorAgent() {
  console.log("🤖 Creating calculator agent with LangChain tools");

  // Define the tools the agent will have access to
  const tools = [new Calculator()];

  try {
    // Initialize the Google Gemini model
    const model = new ChatGoogleGenerativeAI({
      model: "gemini-1.5-flash", // Use the appropriate Gemini model
      temperature: 0,
      apiKey: process.env.GOOGLE_API_KEY as string,
    });

    // Create agent prompt
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful assistant with access to a calculator tool.
      
When presented with mathematical questions or arithmetic calculations, use the calculator tool to compute the result.
For non-mathematical questions, provide a direct response without using the calculator.

Always give concise answers without unnecessary explanations unless requested.`,
      ],
      ["human", "{input}"],
    ]);

    // Create the agent with the calculator tool
    const agent = await createStructuredChatAgent({
      llm: model,
      tools,
      prompt,
    });

    // Create the executor that runs the agent
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true, // Set to true to see the full execution process in logs
    });

    console.log("✅ Calculator agent created successfully");
    return agentExecutor;
  } catch (error) {
    console.error("❌ Error creating calculator agent:", error);
    throw error;
  }
}

/**
 * Run the calculator agent on a query
 *
 * This function takes a user query, creates a calculator agent if needed,
 * and runs the query through the agent which will automatically decide
 * whether to use the calculator tool or not.
 *
 * @param query - The user's query
 * @returns The agent's response
 */
async function runCalculatorAgent(query: string): Promise<string> {
  console.log(`🧮 Running calculator agent for query: "${query}"`);

  try {
    // Create the calculator agent
    const agent = await createCalculatorAgent();

    // Execute the agent with the query
    console.log("🤖 Executing calculator agent...");
    const result = await agent.invoke({
      input: query,
    });

    console.log("✅ Calculator agent execution completed");
    console.log(`📊 Result: ${result.output}`);

    return result.output;
  } catch (error) {
    console.error("❌ Error running calculator agent:", error);
    return `Sorry, I couldn't calculate that. Error: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

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
    const query = formData.get("query") as string;
    const pdfId = formData.get("pdfId");
    const contentType = formData.get("contentType") || "pdf";

    console.log(`📝 Query: "${query}"`);
    console.log(`🔑 Content ID: ${pdfId}`);
    console.log(`📁 Content Type: ${contentType}`);

    // We no longer use the calculator agent here, as it's been moved to its own interface

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

/**
 * Process a calculator query
 *
 * This standalone function handles calculator queries separately from PDF/document queries.
 * It exclusively uses the calculator agent to process mathematical expressions and questions.
 *
 * @param query - The user's calculation query
 * @returns The calculated result as a string
 */
export async function processCalculatorQuery(
  query: string,
): Promise<{ answer: string }> {
  console.log(`🧮 Processing calculator query: "${query}"`);

  try {
    // Use the calculator agent to process the query
    const result = await runCalculatorAgent(query);
    return { answer: result };
  } catch (error) {
    console.error("❌ Error in calculator processing:", error);
    return {
      answer: `Sorry, I couldn't calculate that. Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}
