"use server";

import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Process a streaming chat query using Anthropic's Claude
 *
 * @param query - The user's message
 * @param chatHistory - Previous conversation messages
 * @returns A streaming response from Claude
 */
export async function processAnthropicChat(
  query: string,
  chatHistory: ChatMessage[] = [],
) {
  console.log(`💬 Processing Anthropic chat: "${query}"`);

  try {
    // Prepare messages for the AI
    const messages = [
      ...chatHistory,
      { role: "user" as const, content: query },
    ];

    // Generate streaming response
    return streamText({
      model: anthropic("claude-3-sonnet-20240229"),
      messages,
    });
  } catch (error) {
    console.error("❌ Error in Anthropic chat:", error);
    throw error;
  }
}
