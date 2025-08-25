"use server";

import { anthropic } from "@ai-sdk/anthropic";
import { generateObject, generateText } from "ai";
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
- Never mix a tool call and a normal text reply in the same turn.

Available actions:
1. "list_test_suites" - Lists all available test suites
2. "create_test_case" - Creates a new test case with provided parameters
3. "general_chat" - For general conversation

Analyze the user's message and determine which action is needed. If they're asking to list test suites or create a test case, use the appropriate action. Otherwise, use general_chat.
`;

// Schema for action determination
const ActionSchema = z.object({
  action: z.enum(["list_test_suites", "create_test_case", "general_chat"]),
  reasoning: z.string().describe("Why this action was chosen"),
  parameters: z
    .record(z.any())
    .optional()
    .describe("Parameters needed for the action"),
});

// Schema for test case creation
const TestCaseCreationSchema = z.object({
  url: z.string().describe("The URL for the test case"),
  summary: z.string().describe("Brief summary of what this test case does"),
  method: z
    .enum(["GET", "POST", "PUT", "DELETE", "PATCH"])
    .describe("HTTP method"),
  groupId: z.string().describe("Group/category ID for the test case"),
  tcType: z.string().describe("Type of test case"),
  requestType: z.string().describe("Type of request"),
});

/**
 * Process a general chat query using Vercel AI SDK with Anthropic
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
    // First, determine what action is needed
    const { object: actionDecision } = await generateObject({
      model: anthropic("claude-3-5-sonnet-20241022"),
      system: BASE_SYSTEM_PROMPT,
      prompt: `
        User message: "${query}"
        
        Previous conversation context:
        ${chatHistory.map((msg) => `${msg.role}: ${msg.content}`).join("\n")}
        
        Determine the appropriate action for this user message.
      `,
      schema: ActionSchema,
    });

    console.log("🎯 Action determined:", actionDecision);

    // Handle different actions
    switch (actionDecision.action) {
      case "list_test_suites": {
        try {
          const testSuites = await listTestSuites();
          const response = await generateText({
            model: anthropic("claude-3-5-sonnet-20241022"),
            system: BASE_SYSTEM_PROMPT,
            prompt: `
              The user asked to list test suites. Here are the available test suites:
              ${JSON.stringify(testSuites, null, 2)}
              
              Provide a friendly response that presents this information clearly to the user.
              User's original message: "${query}"
            `,
          });

          return { answer: response.text };
        } catch (error) {
          console.error("Error listing test suites:", error);
          return {
            answer:
              "I encountered an error while trying to list the test suites. Please try again later.",
          };
        }
      }

      case "create_test_case": {
        // Check if we have enough information to create a test case
        const hasRequiredInfo =
          actionDecision.parameters &&
          actionDecision.parameters.url &&
          actionDecision.parameters.method;

        if (!hasRequiredInfo) {
          // Ask for missing information
          const response = await generateText({
            model: anthropic("claude-3-5-sonnet-20241022"),
            system: BASE_SYSTEM_PROMPT,
            prompt: `
              The user wants to create a test case but hasn't provided all the necessary information.
              User's message: "${query}"
              
              Ask for the missing required information in a friendly way. We need:
              - URL (endpoint to test)
              - HTTP method (GET, POST, PUT, DELETE, PATCH)
              - Summary (what this test case does)
              - Group ID (category/group for organization)
              - Test case type
              - Request type
            `,
          });

          return { answer: response.text };
        }

        try {
          // Extract test case parameters using structured generation
          const { object: testCaseParams } = await generateObject({
            model: anthropic("claude-3-5-sonnet-20241022"),
            system:
              "Extract test case creation parameters from the user input.",
            prompt: `
              User wants to create a test case with this input: "${query}"
              
              Extract the following parameters, using reasonable defaults where not specified:
              - url: The API endpoint URL
              - summary: Brief description of the test
              - method: HTTP method (default to GET if not specified)
              - groupId: Group/category (use "default" if not specified)
              - tcType: Test case type (use "api" if not specified)
              - requestType: Request type (use "standard" if not specified)
            `,
            schema: TestCaseCreationSchema,
          });

          // Create the test case
          const newTestCase = await createTestCase({
            id: `tc_${Date.now()}`, // Generate a unique ID
            ...testCaseParams,
          });

          const response = await generateText({
            model: anthropic("claude-3-5-sonnet-20241022"),
            system: BASE_SYSTEM_PROMPT,
            prompt: `
              A test case was successfully created with these details:
              ${JSON.stringify(newTestCase, null, 2)}
              
              Provide a friendly confirmation message to the user about the test case creation.
              User's original message: "${query}"
            `,
          });

          return {
            answer: response.text,
            testCase: newTestCase,
          };
        } catch (error) {
          console.error("Error creating test case:", error);
          return {
            answer:
              "I encountered an error while creating the test case. Please check your parameters and try again.",
          };
        }
      }

      default: {
        // General chat - just have a conversation
        const messages = [
          { role: "system" as const, content: BASE_SYSTEM_PROMPT },
          ...chatHistory,
          { role: "user" as const, content: query },
        ];

        const response = await generateText({
          model: anthropic("claude-3-5-sonnet-20241022"),
          messages,
        });

        return { answer: response.text };
      }
    }
  } catch (error) {
    console.error("❌ Error in general chat:", error);
    return {
      answer: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
    };
  }
}
