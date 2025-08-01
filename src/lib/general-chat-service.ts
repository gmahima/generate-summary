"use server";

import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq";
import { createTestCaseTool, createTestSuiteTool } from "./test-tools";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";

interface TestCase {
  id: string;
  url: string;
  summary: string;
  method: string;
  groupId: string;
  tcType: string;
  requestType: string;
}

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
): Promise<{ answer: string; testCase?: TestCase }> {
  console.log(`💬 Processing general chat: "${query}"`);

  try {
    // Initialize the Groq model
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY as string,
      model: "gemma2-9b-it", // Using Mixtral model for better performance
      temperature: 0.7, // Higher temperature for more creative responses
    });

    // Create tools array
    const tools = [createTestSuiteTool, createTestCaseTool];

    // Create a chat prompt with tools
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        `You are a helpful, friendly, and knowledgeable assistant with access to tools for creating test suites and test cases. 
        When users want to create test suites or test cases, use the appropriate tools.
        For other queries, provide clear, accurate, and engaging responses.
        Be concise but thorough, and maintain a conversational tone.`,
      ],
      ["human", "{input}"],
    ]);

    // Create an agent with the tools
    const agent = await createOpenAIToolsAgent({
      llm: model,
      tools,
      prompt,
    });

    // Create an executor
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });

    // Execute the agent
    const result = await agentExecutor.invoke({ input: query });

    console.log("✅ Chat response generated successfully");
    return { answer: result.output };
  } catch (error) {
    console.error("❌ Error in general chat:", error);
    return {
      answer: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
    };
  }
}
