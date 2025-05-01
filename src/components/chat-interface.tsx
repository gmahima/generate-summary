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

type Message = {
  role: "user" | "assistant";
  content: string;
};

interface ChatInterfaceProps {
  pdfFile: File | null;
}

export function ChatInterface({ pdfFile }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello! I can answer questions about your uploaded PDF. What would you like to know?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async () => {
    if (!input.trim() || !pdfFile) return;

    // Add user message to chat
    const userMessage: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Create FormData to pass to server action
      const formData = new FormData();
      formData.append("file", pdfFile);
      formData.append("query", userMessage.content);

      // Call the query service
      const response = await queryPdfDocument(formData);

      // Add response to chat
      const assistantMessage: Message = {
        role: "assistant",
        content: response.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      // Handle error
      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!pdfFile) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Chat with your PDF</CardTitle>
      </CardHeader>
      <CardContent className="p-4 h-[400px] overflow-y-auto flex flex-col gap-4">
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
