"use server";

import { createOpenAI } from "@ai-sdk/openai";
import {
  convertToModelMessages,
  streamText,
  UIMessage,
  tool,
  stepCountIs,
} from "ai";
import { z } from "zod";
import { createTestCaseTool, listTestSuitesTool } from "./test-tools";

interface OpenAIChatConfig {
  apiKey: string;
  modelName?: string;
}

/**
 * Process a streaming chat query using OpenAI
 *
 * @param messages - Array of UI messages from the chat
 * @param config - Configuration object containing API key and optional model name
 * @returns A streaming response from OpenAI
 */
export async function processOpenAIChat(
  messages: UIMessage[],
  config: OpenAIChatConfig,
) {
  console.log(`💬 Processing OpenAI chat with ${messages.length} messages`);

  try {
    // Create an OpenAI provider instance with the API key
    const provider = createOpenAI({
      apiKey: config.apiKey,
    });

    // Create a model instance with the specified model name (or default to gpt-4)
    const model = provider(config.modelName || "gpt-4");

    const result = streamText({
      model,
      system: "You are a helpful assistant.",
      messages: convertToModelMessages(messages),
      tools: {
        weather: tool({
          description: "Get the weather in a location (farenheit)",
          inputSchema: z.object({
            location: z
              .string()
              .describe("The location to get the weather for"),
          }),
          execute: async ({ location }) => {
            const temperature = Math.round(Math.random() * (90 - 32) + 32);
            return {
              location,
              temperature,
            };
          },
        }),
        convertFahrenheitToCelsius: tool({
          description: "Convert a temperature in fahrenheit to celsius",
          inputSchema: z.object({
            temperature: z
              .number()
              .describe("The temperature in fahrenheit to convert"),
          }),
          execute: async ({ temperature }) => {
            const celsius = Math.round((temperature - 32) * (5 / 9));
            return {
              celsius,
            };
          },
        }),
        listTestSuites: listTestSuitesTool,
        createTestCase: createTestCaseTool,
      },
      stopWhen: stepCountIs(5),
      onStepFinish: async ({ toolResults }) => {
        if (toolResults.length) {
          console.log(JSON.stringify(toolResults, null, 2));
        }
      },
    });
    console.log(await result.toolCalls);
    console.log(await result.toolResults);
    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("❌ Error in OpenAI chat:", error);
    throw error;
  }
}
