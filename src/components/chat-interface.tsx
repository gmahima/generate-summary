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
import { queryPdfDocument } from "@/lib/chat-service";
import { TEMPORARY_USER_ID } from "@/lib/constants";

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
 * Chat Interface Props
 *
 * Props for the ChatInterface component:
 * - pdfFile: The PDF file object that was uploaded
 * - pdfId: The database ID of the stored PDF document (needed for RAG)
 * - userId: The ID of the current user (for storing chat history)
 */
interface ChatInterfaceProps {
  pdfFile: File | null;
  pdfId?: string;
  userId?: string;
}

/**
 * Chat Interface Component
 *
 * Provides a chat interface for users to interact with their PDF documents
 * using Retrieval Augmented Generation (RAG).
 *
 * Features:
 * - Message history display with user/assistant messages
 * - Text input for user questions
 * - Send button to submit queries
 * - Loading indicator during processing
 *
 * The component communicates with the backend RAG service to generate
 * contextually relevant answers based on the PDF content.
 */
export function ChatInterface({
  pdfFile,
  pdfId,
  userId = TEMPORARY_USER_ID,
}: ChatInterfaceProps) {
  // Track chat message history
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I can answer questions about your uploaded PDF. What would you like to know?",
    },
  ]);

  // Track the current input value
  const [input, setInput] = useState("");

  // Track loading state during query processing
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle sending a message to the RAG system
   *
   * This function:
   * 1. Validates the input and required props
   * 2. Adds the user message to the chat
   * 3. Sends the query to the backend RAG service
   * 4. Adds the assistant's response to the chat
   */
  const handleSendMessage = async () => {
    // Validate input and required props
    if (!input.trim()) return;
    if (!pdfId) {
      console.error("Missing pdfId - cannot query document");
      return;
    }

    // Add user message to chat immediately
    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Create FormData to pass to server action
      const formData = new FormData();
      formData.append("query", userMessage.content);
      formData.append("pdfId", pdfId);
      formData.append("userId", userId);

      // Call the RAG service to get an answer
      const response = await queryPdfDocument(formData);

      // Add response to chat
      const assistantMessage: Message = {
        role: "assistant",
        content: response.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Handle error with friendly message
      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Don't render if neither PDF file nor PDF ID is available
  if (!pdfFile && !pdfId) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Chat with your PDF</CardTitle>
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
            placeholder="Ask a question about your PDF..."
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
