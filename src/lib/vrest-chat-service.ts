// import { ChatPromptTemplate } from "@langchain/core/prompts";
// import { ChatGroq } from "@langchain/groq";
// import { AIMessage } from "@langchain/core/messages";
// import { RunnableSequence } from "@langchain/core/runnables";

// interface TestCaseParams {
//   summary: string;
//   description: string;
//   method: string;
//   url: string;
// }

// interface TestCase extends TestCaseParams {
//   id: string;
//   editable: boolean;
//   runnable: boolean;
//   pollingTimeout: number;
//   tags: string[];
//   authorizationId: string;
// }

// async function createTestCase(params: TestCaseParams) {
//   const response = await fetch('http://localhost:3000/test-cases', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//     },
//     body: JSON.stringify(params),
//   });

//   if (!response.ok) {
//     const error = await response.json();
//     throw new Error(error.message || 'Failed to create test case');
//   }

//   return response.json();
// }

// async function listTestSuites() {
//   const response = await fetch('http://localhost:3000/test-suites');
//   if (!response.ok) {
//     const error = await response.json();
//     throw new Error(error.message || 'Failed to list test suites');
//   }
//   return response.json();
// }

// export async function processVrestChat(
//   query: string
// ): Promise<{ answer: string; testCase?: TestCase }> {
//   console.log(`💬 Processing vREST chat: "${query}"`);

//   try {
//     // Initialize the Groq model
//     const model = new ChatGroq({
//       apiKey: process.env.GROQ_API_KEY as string,
//       model: "gemma2-9b-it",
//       temperature: 0.7,
//     });

//     // Create a chat prompt specifically for test case creation
//     const prompt = ChatPromptTemplate.fromMessages([
//       [
//         "system",
//         `You are a test case creation assistant. Help users create test cases by extracting relevant information from their queries.
//         When a user wants to create a test case, extract the following information:
//         - summary: A brief summary of the test case
//         - description: A detailed description of what the test case does
//         - method: The HTTP method (GET, POST, PUT, DELETE, etc.)
//         - url: The API endpoint URL

//         If the user wants to list test suites, call the appropriate function.
//         If the user's query doesn't contain enough information, ask for the missing details.
//         If the query isn't about test cases or test suites, respond normally as a helpful assistant.`,
//       ],
//       ["human", "{input}"],
//     ]);

//     // Format the prompt with the user's query
//     const chain = prompt.pipe(model);
//     const result = await chain.invoke({ input: query });
//     const response = (result as any).content;

//     // Check if the user wants to list test suites
//     if (response.toLowerCase().includes("list test suites") || query.toLowerCase().includes("list test suites")) {
//       const testSuites = await listTestSuites();
//       return {
//         answer: `Here are the test suites:\n${JSON.stringify(testSuites, null, 2)}`,
//       };
//     }

//     // Check if it's a test case creation request
//     if (response.toLowerCase().includes("test case")) {
//       try {
//         // Extract test case parameters from the response
//         // This is a simple example - you might want to make this more sophisticated
//         const params: TestCaseParams = {
//           summary: "Example Test Case",
//           description: "Test case created from chat",
//           method: "GET",
//           url: "https://api.example.com",
//         };

//         const testCase = await createTestCase(params);
//         return {
//           answer: `I've created a test case for you! ${response}`,
//           testCase
//         };
//       } catch (error) {
//         console.error("Error creating test case:", error);
//         return {
//           answer: `I understood you want to create a test case, but I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again with more specific details.`
//         };
//       }
//     }

//     return { answer: response };
//   } catch (error) {
//     console.error("❌ Error in vREST chat:", error);
//     return {
//       answer: `I apologize, but I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
//     };
//   }
// }
