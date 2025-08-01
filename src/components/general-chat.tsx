"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { processGeneralChat } from "@/lib/general-chat-service";
/**
 * Message Type
 *
 * Defines the structure of chat messages in the interface:
 * - role: Identifies whether the message is from the user or assistant
 * - content: The actual text content of the message
 */
type Message = {
  role: "user" | "assistant";
  content: string;
};

/**
 * General Chat Interface Component
 *
 * Provides a chat interface for users to have general conversations with an LLM.
 *
 * Features:
 * - Message history display with user/assistant messages
 * - Text input for user messages
 * - Send button to submit messages
 * - Loading indicator during processing
 */
export function GeneralChat() {
  // Track chat message history
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I'm your vREST assistant. I can help you create test cases and manage test suites. You can ask me to:\n\n- Create a new test case\n- List test suites\n\nWhat would you like to do?",
    },
  ]);

  // Track the current input value
  const [input, setInput] = useState("");

  // Track loading state during processing
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle sending a message to the LLM
   *
   * This function:
   * 1. Validates the input
   * 2. Adds the user message to the chat
   * 3. Sends the message to the LLM
   * 4. Adds the assistant's response to the chat
   */
  const handleSendMessage = async () => {
    // Validate input
    if (!input.trim()) return;

    // Add user message to chat immediately
    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Send message to LLM
      const response = await processGeneralChat(userMessage.content);

      // Add response to chat
      const assistantMessage: Message = {
        role: "assistant",
        content:
          response.answer +
          (response.testCase
            ? `\n\nTest Case Created:\n${JSON.stringify(response.testCase, null, 2)}`
            : ""),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error in chat:", error);

      // Handle error with friendly message
      const errorMessage: Message = {
        role: "assistant",
        content: `I apologize, but I encountered an error: ${
          error instanceof Error ? error.message : "Unknown error"
        }. Please try again.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Chat with AI</CardTitle>
      </CardHeader>
      <CardContent className="p-4 h-[400px] overflow-y-auto flex flex-col gap-4">
        {/* Render chat messages */}
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg p-3 bg-muted">
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Message input and send button */}
      <CardFooter className="p-4 pt-0">
        <div className="flex w-full gap-2">
          <Textarea
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
          >
            Send
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
