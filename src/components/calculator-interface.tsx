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
import { processCalculatorQuery } from "@/lib/chat-service";

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
 * Calculator Interface Component
 *
 * Provides a dedicated chat interface for users to perform mathematical calculations
 * using Google Gemini's AI-powered calculator functionality.
 *
 * Features:
 * - Message history display with user/assistant messages
 * - Text input for calculation queries
 * - Send button to submit queries
 * - Loading indicator during processing
 */
export function CalculatorInterface() {
  // Track chat message history
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Welcome to the Gemini Calculator! I can help you with mathematical calculations. Try asking me things like:
- "What is 125 + 37?"
- "Calculate 25 * 4"
- "Solve 100 / 5"
- "15 - 7"
- "2 * (3 + 4)"
- "What's the square root of 16?"
- "Can you help me find 15% of 80?"

Just type your calculation and I'll solve it for you!`,
    },
  ]);

  // Track the current input value
  const [input, setInput] = useState("");

  // Track loading state during query processing
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle sending a calculation query
   *
   * This function:
   * 1. Validates the input
   * 2. Adds the user message to the chat
   * 3. Sends the query to the calculator service
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
      console.log(`Sending calculation query: "${userMessage.content}"`);

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
        processCalculatorQuery(userMessage.content),
        timeoutPromise,
      ])) as { answer: string };

      // Add response to chat
      const assistantMessage: Message = {
        role: "assistant",
        content: response.answer,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error in calculator request:", error);

      // Handle error with friendly message
      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again or simplify your calculation.`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Show sample calculations
  const handleShowExamples = () => {
    const examplesMessage: Message = {
      role: "assistant",
      content: `Here are some examples of what you can ask me:

1. Basic operations:
   - "What is 23 + 45?"
   - "78 - 32"
   - "12 * 8"
   - "144 / 12"

2. More complex calculations:
   - "What is (18 + 3) * 4 - 7?"
   - "Square root of 169"
   - "5 to the power of 3"
   - "What is 15% of 80?"
   - "Log base 10 of 100"

3. Word problems:
   - "If I have 5 apples and eat 2, how many do I have left?"
   - "If a shirt costs $25 and is on sale for 30% off, what's the final price?"
   - "If a car travels at 60 mph, how far will it go in 2.5 hours?"

Just type your question naturally, and I'll calculate the answer for you!`,
    };
    setMessages((prev) => [...prev, examplesMessage]);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex flex-col sm:flex-row gap-2 justify-between items-start sm:items-center">
          <span>Google Gemini Calculator</span>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShowExamples}
              title="Show calculation examples"
            >
              📝 Examples
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
            placeholder="Type your calculation here..."
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
            Calculate
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
