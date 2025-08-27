import { tool as langchainTool, StructuredToolInterface } from "@langchain/core/tools";
import { tool } from "ai";
import { z } from "zod";

// No schema needed for getTestSuites since it doesn't take any parameters

const bodySchema = z.discriminatedUnion("bodyType", [
  z.object({
    bodyType: z.literal("JSON"),
    bodyContent: z.record(z.any()).describe("A valid JSON object"),
  }),
  z.object({
    bodyType: z.literal("XML"),
    bodyContent: z.string().describe("Raw XML string"),
  }),
  z.object({
    bodyType: z.literal("TEXT"),
    bodyContent: z.string().describe("Plain text body"),
  }),
  z.object({
    bodyType: z.literal("FORM_URL_ENCODED"),
    bodyContent: z
      .array(
        z.object({
          name: z.string().describe("Form field name"),
          value: z.string().describe("Form field value"),
        }),
      )
      .describe("Key-value pairs for form-urlencoded"),
  }),
  z.object({
    bodyType: z.literal("MULTIPART_FORM_DATA"),
    bodyContent: z
      .array(
        z.object({
          name: z.string().describe("Form field name"),
          value: z.string().describe("Form field value"),
        }),
      )
      .describe("Key-value pairs for multipart/form-data"),
  }),
]);

const createTestCaseSchema = z.object({
  testSuiteName: z
    .string()
    .describe(
      "Test suite name to create the test case in",
    ),
  testCaseSummary: z.string().describe("A summary of the the test case"),
  testCasePosition: z.optional(
    z
      .enum(["first", "last"])
      .describe("Where to place the test case in the list. Use last by default"),
  ),
  testCaseURL: z.string().describe("The URL for Test case. Use /api/sample/gen-by-summary-generator-app by default"),
  testCaseRequestMethod: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    .describe("A request method for the test case. Use GET by default"),
  queryParams: z
    .array(
      z.object({
        name: z.string().describe("Name of the parameter"),
        value: z.string().describe("Value of the parameter"),
      }),
    )
    .optional()
    .describe("Array of query or body parameters. Use empty array by default"),
  headers: z
    .array(
      z.object({
        name: z.string().describe("Name of the header"),
        value: z.string().describe("Value of the header"),
      }),
    )
    .optional()
    .describe("Array of header parameters. Use empty array by default"),
  body: bodySchema.optional().describe("Request body details based on type. Use empty object by default"),
});

async function getTestSuites() {
  const response = await fetch("http://localhost:3000/test-suites");
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to fetch test suites");
  }

  return response.json();
}

async function createTestCase(params: z.infer<typeof createTestCaseSchema>) {
  const response = await fetch("http://localhost:3000/test-cases", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: params.testCaseSummary,
      description: "",
      method: params.testCaseRequestMethod,
      url: params.testCaseURL,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create test case");
  }

  return response.json();
}

export const oldListTestSuitesTool: StructuredToolInterface = langchainTool(
  async () => {
    try {
      const testSuites = await getTestSuites();
      const suiteNames = testSuites.map(
        (suite: { name: string }) => suite.name,
      );
      return `Available test suites: ${suiteNames.join(", ")}`;
    } catch (err) {
      return err instanceof Error ? err.message : "Unknown error occurred";
    }
  },
  {
    name: "list_test_suites",
    description: "Use this tool to get a list of all available test suites",
    schema: z.object({}), // Empty schema since no parameters needed
  },
);

export const listTestSuitesTool = tool({
  description: "Use this tool to get a list of all available test suites",
  inputSchema: z.object({}),
  execute: async () => {
    const testSuites = await getTestSuites();
    const suiteNames = testSuites.map((suite: { name: string }) => suite.name);
    return suiteNames;
  },
});

export const oldCreateTestCaseTool: StructuredToolInterface = langchainTool(
  async (params) => {
    try {
      await createTestCase(params);
      return `Test case '${params.testCaseSummary}' created successfully in test suite '${params.testSuiteName}'`;
    } catch (err) {
      return err instanceof Error ? err.message : "Unknown error occurred";
    }
  },
  {
    name: "create_test_case",
    description:
      "Use this tool whenever the user wants to create a new test case",
    schema: createTestCaseSchema,
  },
);

export const createTestCaseTool = tool({
  description: "Use this tool whenever the user wants to create a new test case",
  inputSchema: createTestCaseSchema,
  execute: async (params) => {
    await createTestCase(params);
    return `Test case '${params.testCaseSummary}' created successfully in test suite '${params.testSuiteName}'`;
  },
});