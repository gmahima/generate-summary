"use server";

import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, UIMessage } from "ai";

/**
 * Process a streaming chat query using OpenAI
 *
 * @param messages - Array of UI messages from the chat
 * @returns A streaming response from OpenAI
 */
export async function processOpenAIChat(messages: UIMessage[]) {
  console.log(`💬 Processing OpenAI chat with ${messages.length} messages`);

  try {
    const result = streamText({
      model: openai("gpt-4"),
      system: "You are a helpful assistant.",
      messages: convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("❌ Error in OpenAI chat:", error);
    throw error;
  }
}
