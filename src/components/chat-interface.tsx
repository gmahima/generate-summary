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
import {
  testServerAction,
  testDatabaseAccess,
  testEmbeddings,
  testVectorStore,
  checkDatabaseContent,
  checkMatchDocumentsFunction,
} from "@/lib/test-service";
import { TEMPORARY_USER_ID } from "@/lib/constants";
import Link from "next/link";

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
 * - contentType: The type of content being queried (pdf or link)
 */
interface ChatInterfaceProps {
  pdfFile: File | null;
  pdfId?: string;
  userId?: string;
  contentType?: "pdf" | "link";
}

/**
 * Chat Interface Component
 *
 * Provides a chat interface for users to interact with their content (PDF or link)
 * using Retrieval Augmented Generation (RAG).
 *
 * Features:
 * - Message history display with user/assistant messages
 * - Text input for user questions
 * - Send button to submit queries
 * - Loading indicator during processing
 *
 * The component communicates with the backend RAG service to generate
 * contextually relevant answers based on the content.
 */
export function ChatInterface({
  pdfFile,
  pdfId,
  userId = TEMPORARY_USER_ID,
  contentType = "pdf",
}: ChatInterfaceProps) {
  // Track chat message history
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        contentType === "pdf"
          ? "Hello! I can answer questions about your uploaded PDF. What would you like to know?"
          : "Hello! I can answer questions about your web page. What would you like to know?",
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
      const errorMessage: Message = {
        role: "assistant",
        content:
          "Sorry, I don't have access to any document to query. Please make sure you've uploaded or selected a PDF first.",
      };
      setMessages((prev) => [...prev, errorMessage]);
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
      formData.append("contentType", contentType);

      console.log(
        `Sending query for content ID: ${pdfId}, type: ${contentType}`,
      );

      // Set a timeout to detect if server actions aren't responding
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(
            new Error(
              "Request to server timed out - server actions may not be working",
            ),
          );
        }, 10000); // 10 second timeout
      });

      // Race between the actual query and the timeout
      const response = (await Promise.race([
        queryPdfDocument(formData),
        timeoutPromise,
      ])) as { answer: string };

      // Add response to chat
      const assistantMessage: Message = {
        role: "assistant",
        content: response.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error in chat request:", error);

      // Handle error with friendly message
      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. This could be a server-side issue with the RAG implementation.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new function to test server actions
  const handleTestServerAction = async () => {
    setIsLoading(true);
    try {
      const result = await testServerAction();
      // Add the result as a message
      const testMessage: Message = {
        role: "assistant",
        content: `Server test result: ${result.status}. ${result.message}`,
      };
      setMessages((prev) => [...prev, testMessage]);
    } catch (error) {
      console.error("Error testing server action:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Server test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a new function to test database access
  const handleTestDatabase = async () => {
    if (!pdfId) {
      const errorMessage: Message = {
        role: "assistant",
        content: "No PDF ID available. Please select a PDF first.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await testDatabaseAccess(pdfId);

      // Add the result as a message
      const chunks = result.data?.sampleChunks || [];
      const chunkPreview =
        chunks.length > 0
          ? `\n\nSample chunk content: "${typeof chunks[0]?.content === "string" ? chunks[0].content.substring(0, 100) : ""}..."`
          : "";

      const testMessage: Message = {
        role: "assistant",
        content: `Database test result: ${result.status}. ${result.message}${chunkPreview}`,
      };
      setMessages((prev) => [...prev, testMessage]);
    } catch (error) {
      console.error("Error testing database access:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Database test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to test embeddings
  const handleTestEmbeddings = async () => {
    setIsLoading(true);
    try {
      const result = await testEmbeddings();

      // Add the result as a message
      const embeddingPreview = result.data?.embedding
        ? `\n\nSample embedding dimensions: [${result.data.embedding.join(", ")}]...`
        : "";

      const testMessage: Message = {
        role: "assistant",
        content: `Embeddings test result: ${result.status}. ${result.message}${embeddingPreview}`,
      };
      setMessages((prev) => [...prev, testMessage]);
    } catch (error) {
      console.error("Error testing embeddings:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Embeddings test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to test the vector store
  const handleTestVectorStore = async () => {
    if (!pdfId) {
      const errorMessage: Message = {
        role: "assistant",
        content: "No PDF ID available. Please select a PDF first.",
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    setIsLoading(true);
    try {
      const result = await testVectorStore(pdfId);

      // Add the result as a message
      let docPreview = "";
      if (result.data?.retrievedDocs && result.data.retrievedDocs.length > 0) {
        const doc = result.data.retrievedDocs[0];
        docPreview = `\n\nSample retrieved content: "${doc.content}"`;
      }

      const testMessage: Message = {
        role: "assistant",
        content: `Vector store test result: ${result.status}. ${result.message}${docPreview}`,
      };
      setMessages((prev) => [...prev, testMessage]);
    } catch (error) {
      console.error("Error testing vector store:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Vector store test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to check database content
  const handleCheckDatabase = async () => {
    setIsLoading(true);
    try {
      const result = await checkDatabaseContent();

      // Format the result for display
      let details = "";
      if (result.data) {
        const data = result.data as {
          chunkCount?: number;
          sampleData?: {
            content_preview: string;
            has_embedding: boolean;
            embedding_length: number;
            metadata: Record<string, unknown>;
          };
        };
        if (data.chunkCount) {
          details += `\n\nChunk count: ${data.chunkCount}`;
        }
        if (data.sampleData) {
          const sample = data.sampleData;
          details += `\n\nSample data:`;
          details += `\n- Content: "${sample.content_preview}..."`;
          details += `\n- Has embedding: ${sample.has_embedding}`;
          details += `\n- Embedding length: ${sample.embedding_length}`;
          details += `\n- Metadata: ${JSON.stringify(sample.metadata)}`;
        }
      }

      const testMessage: Message = {
        role: "assistant",
        content: `Database content check: ${result.status}. ${result.message}${details}`,
      };
      setMessages((prev) => [...prev, testMessage]);
    } catch (error) {
      console.error("Error checking database content:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Database content check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Add a function to check match_documents function
  const handleCheckMatchFunction = async () => {
    setIsLoading(true);
    try {
      const result = await checkMatchDocumentsFunction();

      const testMessage: Message = {
        role: "assistant",
        content: `Match function check: ${result.status}. ${result.message}`,
      };
      setMessages((prev) => [...prev, testMessage]);
    } catch (error) {
      console.error("Error checking match_documents function:", error);
      const errorMessage: Message = {
        role: "assistant",
        content: `Match function check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
        <CardTitle className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
          <span>
            Chat with your {contentType === "pdf" ? "PDF" : "web page"}
          </span>
          <div className="flex flex-wrap gap-2">
            <Link href="/calculator">
              <Button variant="outline" size="sm" title="Go to Calculator">
                📱 Calculator
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestServerAction}
              disabled={isLoading}
            >
              Test Server
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestDatabase}
              disabled={isLoading || !pdfId}
            >
              Test Database
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestEmbeddings}
              disabled={isLoading}
            >
              Test Embeddings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTestVectorStore}
              disabled={isLoading || !pdfId}
            >
              Test Vector Store
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckDatabase}
              disabled={isLoading}
            >
              Check Database
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCheckMatchFunction}
              disabled={isLoading}
            >
              Check Match Function
            </Button>
          </div>
        </CardTitle>
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
            placeholder={`Ask a question about your ${contentType === "pdf" ? "PDF" : "web page"} or try a calculation...`}
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
