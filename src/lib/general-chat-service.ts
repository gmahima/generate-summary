"use server";

import { ChatGroq } from "@langchain/groq";
import { createTestCaseTool, listTestSuitesTool } from "./test-tools";
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  BaseMessage,
} from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import { RunnableConfig } from "@langchain/core/runnables";

interface TestCase {
  id: string;
  url: string;
  summary: string;
  method: string;
  groupId: string;
  tcType: string;
  requestType: string;
}

/**
 * Process a general chat query using LangGraph with LangSmith tracing
 */
export async function processGeneralChat(
  query: string,
  chatHistory: (SystemMessage | HumanMessage | AIMessage)[] = [
    new SystemMessage(
      "You are an AI assistant for API testing. Use the 'list_test_suites' tool to show all available test suites. Do not mix tool calls and text responses. If any detail is missing, ask the user for it.",
    ),
  ],
  userId?: string, // Optional user ID for better tracing
): Promise<{ answer: string; testCase?: TestCase; traceUrl?: string }> {
  console.log(`💬 Processing general chat: "${query}"`);

  try {
    // Initialize the Groq model
    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY as string,
      model: "gemma2-9b-it",
      temperature: 0,
    });

    // Create tools array
    const tools = [listTestSuitesTool, createTestCaseTool];
    const modelWithTools = model.bindTools(tools);

    // Define the chatbot function
    async function chatbot(state: typeof MessagesAnnotation.State) {
      return { messages: [await modelWithTools.invoke(state.messages)] };
    }

    // Create tool node
    const toolNode = new ToolNode(tools);

    // Define routing logic
    function shouldContinue(state: typeof MessagesAnnotation.State) {
      const messages = state.messages;
      const lastMessage = messages[messages.length - 1];

      // if (lastMessage.tool_calls?.length) {
      //   return "tools";
      // }
      if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
        return "tools";
      }
      return END;
    }

    // Create the graph
    const workflow = new StateGraph(MessagesAnnotation)
      .addNode("agent", chatbot)
      .addNode("tools", toolNode)
      .addEdge(START, "agent")
      .addConditionalEdges("agent", shouldContinue)
      .addEdge("tools", "agent");

    // Compile the graph
    const checkpointer = new MemorySaver();
    const app = workflow.compile({ checkpointer });

    // Prepare messages for the graph
    const messages: BaseMessage[] = [...chatHistory, new HumanMessage(query)];

    // Configure LangSmith tracing with custom metadata
    const runConfig: RunnableConfig = {
      configurable: {
        thread_id: userId ? `user-${userId}` : `chat-${Date.now()}`,
      },
      // LangSmith configuration
      runName: "API Testing Assistant",
      tags: ["api-testing", "groq", "langgraph"],
      metadata: {
        user_id: userId,
        query_type: "general_chat",
        model: "gemma2-9b-it",
        timestamp: new Date().toISOString(),
        tools_available: tools.map((tool) => tool.name),
      },
    };

    // Execute the graph with LangSmith tracing
    const finalState = await app.invoke({ messages }, runConfig);

    // Extract the final response
    const lastMessage = finalState.messages[finalState.messages.length - 1];
    const answer = lastMessage.content as string;

    console.log("✅ Chat response generated successfully");
    console.log("Result:", answer);

    // Generate trace URL (you can customize this based on your LangSmith setup)
    const traceUrl = `https://smith.langchain.com/trace/${runConfig.runId}`;

    return {
      answer,
      traceUrl: process.env.LANGSMITH_TRACING === "true" ? traceUrl : undefined,
    };
  } catch (error) {
    console.error("❌ Error in general chat:", error);
    return {
      answer: `I apologize, but I encountered an error: ${
        error instanceof Error ? error.message : "Unknown error"
      }. Please try again.`,
    };
  }
}
