"use server";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq";

/**
 * Process a general chat query
 *
 * This function handles general chat conversations with the LLM without any specific context.
 * It uses the Groq model to generate responses to user queries.
 *
 * @param query - The user's message
 * @returns The LLM's response as a string
 */
export async function processGeneralChat(
  query: string,
): Promise<{ answer: string }> {
  console.log(`💬 Processing general chat: "${query}"`);

  try {
    // Initialize the Groq model
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY as string,
      model: "gemma2-9b-it", // Using Mixtral model for better performance
      temperature: 0.7, // Higher temperature for more creative responses
    });

    // Create a simple chat prompt
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful, friendly, and knowledgeable assistant. 
        Provide clear, accurate, and engaging responses to user queries.
        Be concise but thorough, and maintain a conversational tone.`,
      ],
      ["human", "{input}"],
    ]);

    // Format the prompt with the user's query
    const chain = prompt.pipe(model);
    const result = await chain.invoke({ input: query });

    console.log("✅ Chat response generated successfully");
    return { answer: result.content.toString() };
  } catch (error) {
    console.error("❌ Error in general chat:", error);
    return {
      answer: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
    };
  }
}
