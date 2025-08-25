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
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

export function OpenAIChat() {
  const [inputValue, setInputValue] = useState("");

  const { messages, status, sendMessage } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || status !== "ready") return;

    sendMessage({ text: inputValue });
    setInputValue("");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Chat with GPT-4</CardTitle>
      </CardHeader>
      <CardContent className="p-4 h-[400px] overflow-y-auto flex flex-col gap-4">
        {/* Render chat messages */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-3 whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {message.parts.map((part, index) =>
                part.type === "text" ? (
                  <span key={index}>{part.text}</span>
                ) : null,
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {status === "streaming" && (
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
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Textarea
            placeholder="Type your message..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="resize-none"
            disabled={status !== "ready"}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            disabled={!inputValue.trim() || status !== "ready"}
          >
            Send
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
