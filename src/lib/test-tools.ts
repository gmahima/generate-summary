import { tool, StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";

const createTestSuiteSchema = z.object({
  testSuiteName: z.string().describe("The name of the test suite to create"),
  testSuiteDescription: z.optional(
    z.string().describe("A description of the test suite"),
  ),
  testSuitePosition: z.optional(
    z
      .enum(["first", "last"])
      .describe("Where to place the test suite in the list"),
  ),
});

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
      "The test case will be created under this specified test suite name.",
    ),
  testCaseSummary: z.string().describe("A summary of the the test case"),
  testCasePosition: z.optional(
    z
      .enum(["first", "last"])
      .describe("Where to place the test case in the list"),
  ),
  testCaseURL: z.string().describe("The URL for Test case"),
  testCaseRequestMethod: z
    .enum(["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
    .describe("A request method for the test case"),
  queryParams: z
    .array(
      z.object({
        name: z.string().describe("Name of the parameter"),
        value: z.string().describe("Value of the parameter"),
      }),
    )
    .optional()
    .describe("Array of query or body parameters"),
  headers: z
    .array(
      z.object({
        name: z.string().describe("Name of the header"),
        value: z.string().describe("Value of the header"),
      }),
    )
    .optional()
    .describe("Array of header parameters"),
  body: bodySchema.optional().describe("Request body details based on type"),
});

async function createTestSuite(params: z.infer<typeof createTestSuiteSchema>) {
  const response = await fetch("http://localhost:3000/test-suites", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: params.testSuiteName,
      description: params.testSuiteDescription || "",
      parentId: null,
      position: params.testSuitePosition === "first" ? "1" : "2",
      afterTestSuiteId: null,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create test suite");
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
      isNewGroup: false,
      url: params.testCaseURL,
      groupId: params.testSuiteName,
      newGroupId: "",
      summary: params.testCaseSummary,
      method: params.testCaseRequestMethod,
      position: params.testCasePosition === "first" ? "1" : "3",
      generateOption: "direct",
      specificationId: "",
      tcType: "normal",
      generateMultipleColumnsForRequestBody: false,
      operationId: "",
      templateId: "",
      requestType: "testcase",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to create test case");
  }

  const testCase = await response.json();

  // Add query parameters
  if (params.queryParams) {
    for (const param of params.queryParams) {
      await fetch(`http://localhost:3000/test-cases/${testCase.id}/params`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "testcase",
          tcId: testCase.id,
          name: param.name,
          value: param.value,
          type: "query",
        }),
      });
    }
  }

  // Add request body
  if (params.testCaseRequestMethod !== "GET" && params.body) {
    if (
      params.body.bodyType === "XML" ||
      params.body.bodyType === "TEXT" ||
      params.body.bodyType === "JSON"
    ) {
      await fetch(`http://localhost:3000/test-cases/${testCase.id}/body`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "testcase",
          tcId: testCase.id,
          content:
            params.body.bodyType === "JSON"
              ? JSON.stringify(params.body.bodyContent)
              : params.body.bodyContent,
          type: params.body.bodyType.toLowerCase(),
        }),
      });
    }

    if (params.body.bodyType === "FORM_URL_ENCODED") {
      for (const param of params.body.bodyContent) {
        await fetch(`http://localhost:3000/test-cases/${testCase.id}/params`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestType: "testcase",
            tcId: testCase.id,
            name: param.name,
            value: param.value,
            type: "form",
          }),
        });
      }
    }
  }

  // Add headers
  if (params.headers) {
    for (const header of params.headers) {
      await fetch(`http://localhost:3000/test-cases/${testCase.id}/headers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "testcase",
          tcId: testCase.id,
          name: header.name,
          value: header.value,
        }),
      });
    }
  }

  return testCase;
}

export const createTestSuiteTool: StructuredToolInterface = tool(
  async (params) => {
    try {
      await createTestSuite(params);
      return `Test suite '${params.testSuiteName}' created successfully`;
    } catch (err) {
      return err instanceof Error ? err.message : "Unknown error occurred";
    }
  },
  {
    name: "create_test_suite",
    description:
      "Use this tool whenever the user explicitly wants to create a new test suite",
    schema: createTestSuiteSchema,
  },
);

export const createTestCaseTool: StructuredToolInterface = tool(
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
