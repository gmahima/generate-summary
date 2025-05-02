"use server";

import { ChatGroq } from "@langchain/groq";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { Document } from "@langchain/core/documents";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { LANGUAGE_CONFIG, SupportedLanguage } from "./language-config";

/**
 * Generates a summary of a PDF file or web page using AI with LangChain and Groq
 */
export async function generateSummary(formData: FormData): Promise<string> {
  console.log("🚀 Starting content summary generation process");

  // Get parameters from formData
  const file = formData.get("file") as File;
  const url = formData.get("url") as string;
  const contentId = formData.get("contentId") as string;
  const contentType = (formData.get("contentType") as "pdf" | "link") || "pdf";
  const language = (formData.get("language") as SupportedLanguage) || "english";
  const languageConfig = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.english;

  console.log(
    `🌐 Selected output language for summary: ${languageConfig.outputLanguage}`,
  );

  // Check if we have a file, URL, or contentId
  if (!file && !url && !contentId) {
    console.error(
      "❌ Neither file, URL, nor contentId provided in the form data",
    );
    throw new Error("No file, URL, or content ID provided");
  }

  let docs: Document[] = [];
  let tempFilePath = "";

  // Handle content from file upload (PDF)
  if (file) {
    console.log(
      `📄 Processing uploaded file: ${file.name}, Size: ${(file.size / 1024).toFixed(2)} KB, Type: ${file.type}`,
    );

    // Create a temporary file for the PDF
    const tempDir = os.tmpdir();
    tempFilePath = path.join(tempDir, `pdf-${Date.now()}.pdf`);

    try {
      console.log("📥 Converting file to buffer...");
      // Convert File to Buffer for processing
      const fileBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(fileBuffer);
      console.log(`✅ Converted to buffer of size: ${buffer.length} bytes`);

      // Write buffer to temporary file
      console.log(`💾 Writing PDF data to temporary file: ${tempFilePath}`);
      fs.writeFileSync(tempFilePath, buffer);
      console.log("✅ Temporary file created");

      // Load and parse the PDF using the file path
      console.log("📚 Loading and parsing PDF content...");
      const loader = new PDFLoader(tempFilePath);
      docs = await loader.load();
      console.log(`📄 Loaded ${docs.length} pages from PDF`);
    } catch (error) {
      console.error("❌ Error processing uploaded file:", error);
      throw error;
    }
  }
  // Handle URL input
  else if (url) {
    console.log(`🔗 Processing URL: ${url}`);

    try {
      // Use CheerioWebBaseLoader to extract text from the URL
      console.log("📚 Loading and parsing web page content...");
      const loader = new CheerioWebBaseLoader(url);
      docs = await loader.load();
      console.log(`📄 Loaded content from URL: ${url}`);
    } catch (error) {
      console.error("❌ Error loading URL content:", error);
      throw error;
    }
  }
  // Handle content from library (using contentId)
  else if (contentId) {
    console.log(`📚 Retrieving content from database for ID: ${contentId}`);

    try {
      // Import the createClient function from supabase
      const { createClient } = await import("@supabase/supabase-js");

      // Initialize Supabase client
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
      const supabaseServiceKey = process.env
        .SUPABASE_SERVICE_ROLE_KEY as string;
      const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch the content from the database
      const { data: contentData, error: contentError } = await supabaseClient
        .from("pdfs")
        .select("content, name")
        .eq("id", contentId)
        .single();

      if (contentError) {
        console.error(
          "❌ Error retrieving content from database:",
          contentError,
        );
        throw new Error(`Failed to retrieve content: ${contentError.message}`);
      }

      if (!contentData || !contentData.content) {
        console.error("❌ No content found for ID:", contentId);
        throw new Error("Content not found in database");
      }

      console.log(
        `📄 Retrieved content for "${contentData.name}" from database`,
      );

      // Create a Document object from the database content
      docs = [
        new Document({
          pageContent: contentData.content,
          metadata: { source: `Database content ID: ${contentId}` },
        }),
      ];
    } catch (error) {
      console.error("❌ Error retrieving content from database:", error);
      throw error;
    }
  }

  if (docs.length === 0) {
    console.warn("⚠️ No content extracted");
    return "Could not extract any content from the provided source.";
  }

  // Log a sample of the first page content
  console.log(
    `📝 First content sample: "${docs[0]?.pageContent.substring(0, 100)}..."`,
  );

  try {
    // Split the document into manageable chunks
    console.log("✂️ Splitting document into chunks...");
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 100,
    });
    const splits = await textSplitter.splitDocuments(docs);
    console.log(`🧩 Split document into ${splits.length} chunks`);

    // Log some information about the chunks
    if (splits.length > 0) {
      console.log(
        ` Average chunk size: ${splits.reduce((sum, doc) => sum + doc.pageContent.length, 0) / splits.length} characters`,
      );
      console.log(
        `📊 First chunk sample: "${splits[0]?.pageContent.substring(0, 50)}..."`,
      );
    }

    // Initialize the Groq model
    // Note: You'll need to set GROQ_API_KEY in your environment variables
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.warn(
        "⚠️ No GROQ_API_KEY found in environment variables. Using fallback summary.",
      );
      return `Summary of content (API key not configured)\n\nTo generate real summaries, please add your Groq API key to the environment variables.\n\nGet your API key from: https://console.groq.com/keys\n\nThe content contained ${splits.length} text chunks with content related to: "${splits[0]?.pageContent.substring(0, 100)}..."`;
    }

    console.log("🤖 Initializing Groq model...");
    const model = new ChatGroq({
      apiKey,
      model: "llama-3.1-8b-instant", // Using Llama3.1 8B Instant
      temperature: 0,
    });
    console.log("✅ Groq model initialized");

    // Create a prompt template for summarization with language output instructions
    console.log("📝 Creating prompt template...");
    const summaryPrompt = PromptTemplate.fromTemplate(`
      You are a professional ${contentType === "pdf" ? "document" : "web page"} summarizer.
      
      Below is the content from a ${contentType === "pdf" ? "PDF document" : "web page"}. Please create a comprehensive summary 
      that captures the key points, main arguments, and conclusions. The summary should be 
      well-structured, clear, and concise while preserving the important details.
      
      IMPORTANT: Your summary MUST be written entirely in ${languageConfig.outputLanguage} language.
      
      Content:
      {text}
      
      ${languageConfig.outputLanguage} Summary:
    `);

    // Prepare the text input (join chunks with reasonable limit)
    console.log("🔄 Preparing text input for model...");
    const combinedText = splits
      .map((split: Document) => split.pageContent)
      .join("\n\n")
      .substring(0, 32000);
    console.log(`📊 Combined text length: ${combinedText.length} characters`);

    // Create a chain for the summarization process
    console.log("⛓️ Creating processing chain...");
    const chain = RunnableSequence.from([
      summaryPrompt,
      model,
      new StringOutputParser(),
    ]);

    // Execute the chain
    console.log(`🏃 Executing summarization chain in ${language}...`);
    console.time("summarization");
    const summary = await chain.invoke({
      text: combinedText,
    });
    console.timeEnd("summarization");
    console.log(`✅ Summary generated (${summary.length} characters)`);

    // Clean up
    if (tempFilePath) {
      console.log("🧹 Cleaning up resources...");
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log("✅ Temporary file removed");
      }
      console.log("✅ Resources cleaned up");
    }

    console.log("🎉 Summary generation completed successfully");
    return summary;
  } catch (error) {
    console.error("❌ Error generating summary:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));

    // Clean up temporary file in case of error
    if (tempFilePath) {
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          console.log("✅ Temporary file removed during error handling");
        }
      } catch (cleanupError) {
        console.error("❌ Error cleaning up temporary file:", cleanupError);
      }
    }

    return `Failed to generate summary: ${error instanceof Error ? error.message : String(error)}`;
  }
}
