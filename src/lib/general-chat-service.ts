"use server";

import { ChatGroq } from "@langchain/groq";
import { ChatAnthropic } from "@langchain/anthropic";
import { createTestCaseTool, listTestSuitesTool } from "./test-tools";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import {
  SystemMessage,
  HumanMessage,
  AIMessage,
  FunctionMessage,
} from "@langchain/core/messages";
import { StateGraph, END } from "@langchain/langgraph";
import { RunnableSequence } from "@langchain/core/runnables";

import { ToolExecutor } from "@langchain/langgraph/prebuilt";

interface TestCase {
  id: string;
  url: string;
  summary: string;
  method: string;
  groupId: string;
  tcType: string;
  requestType: string;
}

// Define state type
interface AgentState {
  messages: (SystemMessage | HumanMessage | AIMessage | FunctionMessage)[];
  chat_history: (SystemMessage | HumanMessage | AIMessage | FunctionMessage)[];
  current_input: string;
  tools_output?: Record<string, unknown>;
  testCase?: TestCase;
}

/**
 * Process a general chat query
 *
 * This function handles general chat conversations with the LLM without any specific context.
 * It uses the Groq model to generate responses to user queries.
 *
 * @param query - The user's message
 * @returns The LLM's response as a string
 */

function getLLM(provider: "groq" | "anthropic") {
  if (provider === "groq") {
    return new ChatGroq({
      apiKey: process.env.GROQ_API_KEY!,
      model: "llama-3.3-70b-versatile",
      temperature: 0,
    });
  }

  if (provider === "anthropic") {
    return new ChatAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
      model: "claude-3-5-sonnet-20240620",
      temperature: 0,
    });
  }
  throw new Error(`unsupported provider: ${provider}`);
}

const BASE_SYSTEM_PROMPT = `
You are the vREST assistant.

Tool policy:
- ONLY call tools when the user explicitly asks to list test suites or to create a test case.
- For greetings, small talk, or general questions that don’t require tools, reply conversationally and DO NOT call any tool.
- If a tool action is requested but some details are missing, ask clarifying questions first.
- Never mix a tool call and a normal text reply in the same turn.
`;

export async function processGeneralChat(
  query: string,
  chatHistory: (SystemMessage | HumanMessage | AIMessage)[] = [
    new SystemMessage(BASE_SYSTEM_PROMPT),
  ],
  provider: "groq" | "anthropic" = process.env.LLM_PROVIDER as
    | "groq"
    | "anthropic",
): Promise<{ answer: string; testCase?: TestCase }> {
  console.log(
    `💬 Processing general chat with provider=${provider}: "${query}"`,
  );

  try {
    const model = getLLM(provider);
    const tools = [listTestSuitesTool, createTestCaseTool];
    const toolExecutor = new ToolExecutor({ tools });

    // Create the chat prompt
    const chatPrompt = ChatPromptTemplate.fromMessages([
      ["system", BASE_SYSTEM_PROMPT],
      ["placeholder", "{messages}"],
      ["human", "{current_input}"],
    ]);

    // Create agent node to process messages and decide next action
    const agentNode = RunnableSequence.from([
      {
        messages: (state: AgentState) => {
          // Combine chat history with current messages for context
          const allMessages = [...state.chat_history];

          // Add the current input as a human message
          allMessages.push(new HumanMessage(state.current_input));

          return allMessages;
        },
      },
      chatPrompt,
      model,
      async (
        output: AIMessage,
      ): Promise<{ next: string; state: AgentState }> => {
        // Create base state update
        const updatedState: AgentState = {
          messages: [],
          chat_history: [],
          current_input: "",
          tools_output: {},
        };

        if (output.additional_kwargs.function_call) {
          return {
            next: "tool",
            state: updatedState,
          };
        }
        return {
          next: END,
          state: updatedState,
        };
      },
    ]);

    // Create the state graph
    const workflow = new StateGraph({});

    // Add nodes
    workflow.addNode("__start__", agentNode);

    // Create a runnable for the tool node
    const toolRunnable = RunnableSequence.from([
      {
        state: (input: AgentState) => input,
      },
      async (input: { state: AgentState }) => {
        const lastMessage =
          input.state.messages[input.state.messages.length - 1];
        if (
          lastMessage instanceof AIMessage &&
          lastMessage.additional_kwargs.function_call
        ) {
          const action = {
            tool: lastMessage.additional_kwargs.function_call.name,
            toolInput: JSON.parse(
              lastMessage.additional_kwargs.function_call.arguments,
            ),
          };
          const result = await toolExecutor.invoke(action);
          const functionMessage = new FunctionMessage({
            content: JSON.stringify(result),
            name: action.tool,
          });

          // Update both messages and chat history
          const updatedMessages = [...input.state.messages, functionMessage];
          const updatedHistory = [...input.state.chat_history, functionMessage];

          return {
            messages: updatedMessages,
            chat_history: updatedHistory,
            current_input: input.state.current_input,
            tools_output: {
              ...input.state.tools_output,
              [action.tool]: result,
            },
            testCase: input.state.testCase,
          };
        }
        return input.state;
      },
    ]);

    workflow.addNode("__start__", toolRunnable);

    // Add edges
    workflow.addEdge("__start__", END);

    // Set entry point
    workflow.setEntryPoint("__start__");

    // Compile the workflow
    const chain = workflow.compile();

    // Execute the workflow
    const result = (await chain.invoke({
      messages: [],
      chat_history: chatHistory,
      current_input: query,
      tools_output: {},
      testCase: undefined,
    })) as unknown as AgentState;

    // Extract the answer from the result
    const lastMessage = result.messages[
      result.messages.length - 1
    ] as AIMessage;
    const answer =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : JSON.stringify(lastMessage.content);

    console.log("✅ Chat response generated successfully");
    console.log("Result:", result);

    return {
      answer,
      testCase: undefined,
    };
  } catch (error) {
    console.error("❌ Error in general chat:", error);
    return {
      answer: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
    };
  }
}
