"use server";

import { ChatGroq } from "@langchain/groq";
import { createTestCaseTool, listTestSuitesTool } from "./test-tools";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
} from "@langchain/core/messages";

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
  chatHistory: (SystemMessage | HumanMessage | AIMessage)[] = [
    new SystemMessage(
      "You are an AI assistant for API testing. Use the 'list_test_suites' tool to show all available test suites. Do not mix tool calls and text responses. If any detail is missing, ask the user for it.",
    ),
  ],
): Promise<{ answer: string; testCase?: TestCase }> {
  console.log(`💬 Processing general chat: "${query}"`);

  try {
    // Initialize the Groq model
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY as string,
      model: "gemma2-9b-it",
      temperature: 0,
    });

    // Create tools array
    const tools = [listTestSuitesTool, createTestCaseTool];

    // Create the agent
    const agent = createToolCallingAgent({
      llm: model,
      tools,
      prompt: ChatPromptTemplate.fromMessages([
        ["placeholder", "{chat_history}"],
        ["human", "{input}"],
        ["placeholder", "{agent_scratchpad}"],
      ]),
    });

    // Create an executor
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
    });

    // Execute the agent
    const result = await agentExecutor.invoke({
      input: query,
      chat_history: chatHistory,
    });

    console.log("✅ Chat response generated successfully");
    console.log("Result:", result);

    return { answer: result.output };
  } catch (error) {
    console.error("❌ Error in general chat:", error);
    return {
      answer: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
    };
  }
}
