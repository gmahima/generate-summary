import { NextResponse } from "next/server";
import { checkLatestChunkMetadata } from "@/lib/rag-service";
import { createClient } from "@supabase/supabase-js";
import { JinaEmbeddings } from "@langchain/community/embeddings/jina";

/**
 * API route for testing vector embeddings
 *
 * This endpoint is used for testing and debugging the vector store.
 * It can:
 * 1. Check the most recent chunks
 * 2. Test that embeddings are properly stored
 * 3. Test that search works correctly
 */
export async function GET(request: Request) {
  try {
    // The URL might contain query parameters for specific tests
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const pdfId = searchParams.get("pdfId");

    console.log(
      `📝 Test embeddings API called with action: ${action}, pdfId: ${pdfId}`,
    );

    // Run the appropriate test based on the action parameter
    if (action === "check_latest") {
      console.log("🔍 Running check for latest chunks metadata");
      const latestChunks = await checkLatestChunkMetadata();

      return NextResponse.json({
        success: true,
        message: "Latest chunks check completed, see server logs for details",
        chunks: latestChunks,
      });
    }

    if (action === "test_match_function" && pdfId) {
      console.log(`🔍 Testing match_pdf_chunks function with pdfId: ${pdfId}`);

      // Create Supabase client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Create a test embedding vector (all zeros)
      const testVector = new Array(1024).fill(0);

      try {
        // Test the match_pdf_chunks function directly
        console.log("🧪 Testing match_pdf_chunks with zero vector...");
        const { data: directMatch, error: directError } = await supabase.rpc(
          "match_pdf_chunks",
          {
            query_vector: testVector,
            pdf_id_filter: pdfId,
            match_limit: 5,
          },
        );

        if (directError) {
          console.error(
            "❌ Error testing match_pdf_chunks directly:",
            directError,
          );

          return NextResponse.json(
            {
              success: false,
              error: `Error testing match_pdf_chunks: ${directError.message}`,
              details: directError,
            },
            { status: 500 },
          );
        }

        console.log(
          `✅ match_pdf_chunks function returned ${directMatch?.length || 0} results`,
        );

        // Test with an actual query embedding
        console.log("🧪 Testing with actual Jina embedding...");
        // Initialize Jina embeddings
        const embeddings = new JinaEmbeddings({
          apiKey: process.env.JINA_API_KEY as string,
          model: "jina-embeddings-v3",
        });

        // Generate an embedding for a simple query
        const queryEmbedding = await embeddings.embedQuery(
          "What is this document about?",
        );

        // Test the match_pdf_chunks function with the query embedding
        const { data: actualMatch, error: actualError } = await supabase.rpc(
          "match_pdf_chunks",
          {
            query_vector: queryEmbedding,
            pdf_id_filter: pdfId,
            match_limit: 5,
          },
        );

        if (actualError) {
          console.error(
            "❌ Error testing match_pdf_chunks with query embedding:",
            actualError,
          );

          return NextResponse.json({
            success: true,
            message: "Function exists but has an error with real embeddings",
            zeroVectorResults: directMatch,
            error: actualError.message,
          });
        }

        console.log(
          `✅ match_pdf_chunks with query embedding returned ${actualMatch?.length || 0} results`,
        );

        return NextResponse.json({
          success: true,
          message: "match_pdf_chunks function is working correctly",
          zeroVectorResults: directMatch,
          queryResults: actualMatch,
          resultCount: actualMatch?.length || 0,
        });
      } catch (error) {
        console.error("❌ Error testing match_pdf_chunks:", error);

        return NextResponse.json(
          {
            success: false,
            error: `Error in test: ${error instanceof Error ? error.message : String(error)}`,
          },
          { status: 500 },
        );
      }
    }

    // Default response if no specific action requested
    return NextResponse.json({
      success: true,
      message: "Test embeddings API is working",
      availableActions: [
        "check_latest",
        "test_match_function?pdfId=your-pdf-id",
      ],
    });
  } catch (error) {
    console.error("❌ Error in test-embeddings API:", error);
    return NextResponse.json(
      { success: false, error: "Failed to run test" },
      { status: 500 },
    );
  }
}
