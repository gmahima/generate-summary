import { NextResponse } from "next/server";
import {
  testMatchDocumentsLowThreshold,
  inspectEmbeddingFormat,
} from "@/lib/test-service";

export async function GET() {
  try {
    // Run the tests
    const thresholdResult = await testMatchDocumentsLowThreshold();
    const formatResult = await inspectEmbeddingFormat();

    // Return the results
    return NextResponse.json({
      success: true,
      data: {
        thresholdTest: thresholdResult,
        formatInspection: formatResult,
      },
    });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
