import { processOpenAIChat } from "@/lib/openai-chat-service";
import { UIMessage } from "ai";

export async function POST(req: Request) {
  try {
    const { messages }: { messages: UIMessage[] } = await req.json();
    return await processOpenAIChat(messages);
  } catch (error) {
    console.error("API Error:", error);
    return new Response(JSON.stringify({ error: "Failed to process chat" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
