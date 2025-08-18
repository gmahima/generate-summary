"use server";

import { ChatGroq } from "@langchain/groq";
import { ChatAnthropic } from "@langchain/anthropic";
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

function getLLM(provider: "groq" | "anthropic") {
  if (provider === "groq") {
    return new ChatGroq({
      apiKey: process.env.GROQ_API_KEY!,
      model: "llama-3.3-70b-versatile",
      temperature: 0,
    });
  }

  if (provider === "anthropic") {
    return new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: "claude-3-5-sonnet-20240620",
      temperature: 0,
    });
  }
  throw new Error(`unsupported provider: ${provider}`);
}

const BASE_SYSTEM_PROMPT = `
You are the vREST assistant.

Tool policy:
- ONLY call tools when the user explicitly asks to list test suites or to create a test case.
- For greetings, small talk, or general questions that don’t require tools, reply conversationally and DO NOT call any tool.
- If a tool action is requested but some details are missing, ask clarifying questions first.
- Never mix a tool call and a normal text reply in the same turn.
`;

export async function processGeneralChat(
  query: string,
  chatHistory: (SystemMessage | HumanMessage | AIMessage)[] = [
    // new SystemMessage(
    //   "You are an AI assistant for API testing. Use the 'list_test_suites' tool to show all available test suites. Do not mix tool calls and text responses. If any detail is missing, ask the user for it.",
    // ),
    new SystemMessage(BASE_SYSTEM_PROMPT),
  ],
  provider: "groq" | "anthropic" = process.env.LLM_PROVIDER as
    | "groq"
    | "anthropic",
): Promise<{ answer: string; testCase?: TestCase }> {
  console.log(
    `💬 Processing general chat with provider=${provider}: "${query}"`,
  );

  try {
    // Initialize the Groq model
    // const model = new ChatGroq({
    //   apiKey: process.env.GROQ_API_KEY as string,
    //   model: "gemma2-9b-it",
    //   temperature: 0,
    // });

    const model = getLLM(provider);
    // Create tools array
    const tools = [listTestSuitesTool, createTestCaseTool];

    // Create the agent
    const agent = createToolCallingAgent({
      llm: model,
      tools,
      prompt: ChatPromptTemplate.fromMessages([
        ["system", BASE_SYSTEM_PROMPT],
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
