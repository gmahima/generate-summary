"use server";

import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, tool } from "ai";
import { z } from "zod";
import { createTestCase, listTestSuites } from "./test-tools";

interface TestCase {
  id: string;
  url: string;
  summary: string;
  method: string;
  groupId: string;
  tcType: string;
  requestType: string;
}

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const BASE_SYSTEM_PROMPT = `
You are the vREST assistant.

Tool policy:
- ONLY call tools when the user explicitly asks to list test suites or to create a test case.
- For greetings, small talk, or general questions that don't require tools, reply conversationally and DO NOT call any tool.
- If a tool action is requested but some details are missing, ask clarifying questions first.
- You can call multiple tools in sequence if needed. Results from previous tool calls are available for subsequent calls.

When users ask to create test cases, you can use information from previously listed test suites to choose appropriate groupId values.
`;

// Define tools using the AI SDK tool function
const tools = {
  listTestSuites: tool({
    description: "List all available test suites",
    parameters: z.object({}),
    execute: async () => {
      console.log("🔧 Executing listTestSuites tool");
      try {
        const testSuites = await listTestSuites();
        console.log(`✅ Found ${testSuites.length} test suites`);
        return {
          success: true,
          testSuites,
          count: testSuites.length,
        };
      } catch (error) {
        console.error("❌ Error in listTestSuites tool:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  }),

  createTestCase: tool({
    description: "Create a new test case",
    parameters: z.object({
      url: z.string().describe("The URL for the test case"),
      summary: z.string().describe("Brief summary of what this test case does"),
      method: z
        .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
        .describe("HTTP method"),
      groupId: z.string().describe("Group/category ID for the test case"),
      tcType: z.string().optional().describe("Type of test case"),
      requestType: z.string().optional().describe("Type of request"),
    }),
    execute: async ({ url, summary, method, groupId, tcType, requestType }) => {
      console.log("🔧 Executing createTestCase tool with params:", {
        url,
        summary,
        method,
        groupId,
      });
      try {
        const newTestCase = await createTestCase({
          id: `tc_${Date.now()}`,
          url,
          summary,
          method,
          groupId,
          tcType: tcType || "api",
          requestType: requestType || "standard",
        });

        console.log("✅ Test case created successfully:", newTestCase.id);
        return {
          success: true,
          testCase: newTestCase,
        };
      } catch (error) {
        console.error("❌ Error in createTestCase tool:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    },
  }),
};

/**
 * Process a general chat query using Vercel AI SDK with proper tool calling
 *
 * @param query - The user's message
 * @param chatHistory - Previous conversation messages
 * @returns The response with optional test case data
 */
export async function processGeneralChat(
  query: string,
  chatHistory: ChatMessage[] = [],
): Promise<{ answer: string; testCase?: TestCase }> {
  console.log(`💬 Processing general chat: "${query}"`);

  try {
    // Prepare messages for the AI
    const messages = [
      { role: "system" as const, content: BASE_SYSTEM_PROMPT },
      ...chatHistory,
      { role: "user" as const, content: query },
    ];

    // Generate response with tools
    const result = await generateText({
      model: anthropic("claude-3-5-sonnet-20241022"),
      messages,
      tools,
      stopWhen: stepCountIs(5),
      onStepFinish: async ({ toolResults }) => {
        if (toolResults.length) {
          console.log("🔧 Tool results:", JSON.stringify(toolResults, null, 2));
        }
      },
    });

    console.log("🎯 AI response generated");
    console.log("Tool results:", result.toolResults);

    // Extract test case if one was created
    let testCase: TestCase | undefined;

    // Look for successful test case creation in tool results
    for (const toolResult of result.toolResults) {
      if (
        toolResult.toolName === "createTestCase" &&
        toolResult.result.success
      ) {
        testCase = toolResult.result.testCase;
        break;
      }
    }

    return {
      answer: result.text,
      testCase,
    };
  } catch (error) {
    console.error("❌ Error in general chat:", error);
    return {
      answer: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
    };
  }
}
