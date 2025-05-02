"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { SummaryOutput } from "@/components/summary-output";
import { Button } from "@/components/button";
import { generateSummary } from "@/lib/summary-service";
import { processPdf, processLink } from "@/lib/rag-service";
import { TEMPORARY_USER_ID } from "@/lib/constants";
import { SUPPORTED_LANGUAGES, SupportedLanguage } from "@/lib/language-config";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChatInterface } from "@/components/chat-interface";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PdfLibrary } from "@/components/pdf-library";
import { Input } from "@/components/ui/input";

/**
 * Home Page Component
 *
 * This is the main page of the application that provides:
 * 1. PDF upload or URL input functionality
 * 2. Content summarization
 * 3. Chat interface for querying using RAG
 *
 * The component manages the state for the uploaded file or URL,
 * summary generation, and integrates with the RAG system.
 */
export default function Home() {
  // State for the uploaded PDF file
  const [file, setFile] = useState<File | null>(null);

  // State for the URL input
  const [url, setUrl] = useState<string | null>(null);

  // State for the generated summary
  const [summary, setSummary] = useState<string | null>(null);

  // State for loading indicators
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // State for language selection
  const [language, setLanguage] = useState<SupportedLanguage>("english");

  // State for the processed content ID (for RAG)
  const [contentId, setContentId] = useState<string | null>(null);

  // State for selected content name (for display)
  const [selectedContentName, setSelectedContentName] = useState<string | null>(
    null,
  );

  // Type of content being processed (pdf or link)
  const [contentType, setContentType] = useState<"pdf" | "link">("pdf");

  // Using the imported TEMPORARY_USER_ID constant instead of hardcoding
  const userId = TEMPORARY_USER_ID;

  /**
   * Handle file upload
   * When a new file is uploaded, reset the summary and contentId
   */
  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setSummary(null);
    setContentId(null);
    setSelectedContentName(selectedFile?.name || null);
    setUrl(null);
  };

  /**
   * Handle URL input change
   */
  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
    setSummary(null);
    setContentId(null);
    setFile(null);
  };

  /**
   * Handle language change
   * When language is changed, reset the summary
   */
  const handleLanguageChange = (value: string) => {
    setLanguage(value as SupportedLanguage);
    setSummary(null);
  };

  /**
   * Process the PDF for RAG
   * This prepares the PDF for chat by:
   * 1. Storing the PDF in the database
   * 2. Splitting into chunks
   * 3. Generating embeddings
   */
  const handleProcessPDF = async () => {
    if (!file) {
      toast.error("Please upload a PDF file first");
      return;
    }

    try {
      setIsProcessing(true);

      // Create FormData to pass to server action
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userId);

      // Process the PDF for RAG
      const result = await processPdf(formData);

      // Store the PDF ID for later use in chat
      setContentId(result.pdfId);

      // If we got a summary, use it
      if (result.summary) {
        setSummary(result.summary);
      }

      toast.success("PDF processed successfully! You can now chat with it.");
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast.error("Failed to process PDF for chat");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Process the URL for RAG
   * This prepares the web page content for chat by:
   * 1. Fetching and storing the content in the database
   * 2. Splitting into chunks
   * 3. Generating embeddings
   */
  const handleProcessLink = async () => {
    if (!url) {
      toast.error("Please enter a valid URL first");
      return;
    }

    try {
      setIsProcessing(true);

      // Create FormData to pass to server action
      const formData = new FormData();
      formData.append("url", url);
      formData.append("userId", userId);

      // Process the URL for RAG
      const result = await processLink(formData);

      // Store the content ID for later use in chat
      setContentId(result.contentId);
      setSelectedContentName(url);

      // If we got a summary, use it
      if (result.summary) {
        setSummary(result.summary);
      }

      toast.success("URL processed successfully! You can now chat with it.");
    } catch (error) {
      console.error("Error processing URL:", error);
      toast.error("Failed to process URL for chat");
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Generate a summary of the content
   * This uses the summary service to generate a summary
   */
  const handleGenerateSummary = async () => {
    // Check if we have either a file, URL, or a content ID
    if (!file && !url && !contentId) {
      toast.error("Please upload a PDF or enter a URL first");
      return;
    }

    try {
      setIsLoading(true);

      // Create FormData to pass to server action
      const formData = new FormData();

      // If we have a file, use that
      if (file) {
        formData.append("file", file);
      }

      // If we have a URL, use that
      if (url) {
        formData.append("url", url);
      }

      // If we have a content ID, use that (for library items)
      if (contentId) {
        formData.append("contentId", contentId);
        formData.append("contentType", contentType);
      }

      formData.append("language", language);
      formData.append("userId", userId);

      const result = await generateSummary(formData);
      setSummary(result);
      toast.success("Summary generated successfully");
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate summary");
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle selecting a PDF from the library
   */
  const handleSelectPdf = (id: string, name: string) => {
    setContentId(id);
    setSelectedContentName(name);
    setContentType("pdf");
    // We're using an existing PDF, so we don't have the File object
    setFile(null);
    setUrl(null);
    toast.success(`Selected "${name}" for chat`);
  };

  return (
    <div className="min-h-screen p-6 md:p-12">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">Glance Buddy</h1>
          <p className="text-muted-foreground">
            Upload a PDF or enter a URL to generate summaries and chat with your
            content
          </p>
        </header>

        <div className="grid gap-8">
          <Tabs
            defaultValue="pdf"
            onValueChange={(value) => setContentType(value as "pdf" | "link")}
          >
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="pdf">PDF</TabsTrigger>
              <TabsTrigger value="link">Link</TabsTrigger>
            </TabsList>

            <TabsContent value="pdf" className="mt-6">
              <Tabs defaultValue="upload">
                <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                  <TabsTrigger value="upload">Upload New PDF</TabsTrigger>
                  <TabsTrigger value="library">Your PDF Library</TabsTrigger>
                </TabsList>

                <TabsContent value="upload" className="mt-6">
                  <FileUpload onFileChange={handleFileChange} />
                </TabsContent>

                <TabsContent value="library" className="mt-6">
                  <PdfLibrary onSelectPdf={handleSelectPdf} />
                </TabsContent>
              </Tabs>
            </TabsContent>

            <TabsContent value="link" className="mt-6">
              <div className="flex flex-col space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="url-input">Enter URL</Label>
                  <Input
                    id="url-input"
                    placeholder="https://example.com"
                    type="url"
                    onChange={handleUrlChange}
                    value={url || ""}
                  />
                </div>
                <Button
                  onClick={handleProcessLink}
                  disabled={!url || isProcessing}
                  className="w-full max-w-[200px] mx-auto"
                >
                  {isProcessing
                    ? "Processing..."
                    : "Process Link for Chat & Summary"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>

          {((contentType === "pdf" && (file || contentId)) ||
            (contentType === "link" && (url || contentId))) && (
            <Tabs defaultValue="chat">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                <TabsTrigger value="summary">Generate Summary</TabsTrigger>
                <TabsTrigger value="chat">Chat with Content</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="mt-6">
                <div className="grid gap-6">
                  <div className="grid gap-2">
                    <Label htmlFor="language-select">Summary Language</Label>
                    <Select
                      value={language}
                      onValueChange={handleLanguageChange}
                    >
                      <SelectTrigger
                        id="language-select"
                        className="w-full max-w-[200px]"
                      >
                        <SelectValue placeholder="Select language" />
                      </SelectTrigger>
                      <SelectContent>
                        {SUPPORTED_LANGUAGES.map((lang) => (
                          <SelectItem key={lang.value} value={lang.value}>
                            {lang.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      onClick={handleGenerateSummary}
                      disabled={!((file || url || contentId) && !isLoading)}
                      className="w-full max-w-[200px]"
                    >
                      {isLoading ? "Generating..." : "Generate Summary"}
                    </Button>
                  </div>

                  <SummaryOutput summary={summary} isLoading={isLoading} />
                </div>
              </TabsContent>

              <TabsContent value="chat" className="mt-6">
                <div className="grid gap-6">
                  {!contentId &&
                    ((contentType === "pdf" && file) ||
                      (contentType === "link" && url)) && (
                      <div className="flex flex-col items-center gap-4">
                        <p className="text-center text-muted-foreground">
                          To chat with your content, it needs to be processed
                          first. This extracts the text, splits it into chunks,
                          and generates embeddings for search.
                        </p>
                        <Button
                          onClick={
                            contentType === "pdf"
                              ? handleProcessPDF
                              : handleProcessLink
                          }
                          disabled={
                            contentType === "pdf" ? !file : !url || isProcessing
                          }
                          className="w-full max-w-[200px]"
                        >
                          {isProcessing
                            ? "Processing..."
                            : contentType === "pdf"
                              ? "Process PDF for Chat & Summary"
                              : "Process Link for Chat & Summary"}
                        </Button>
                      </div>
                    )}

                  {contentId && (
                    <>
                      {selectedContentName && (
                        <div className="border rounded-lg p-4 bg-muted/50">
                          <h3 className="font-medium">
                            Currently chatting with:
                          </h3>
                          <p className="text-sm">{selectedContentName}</p>
                        </div>
                      )}
                      <ChatInterface
                        pdfFile={contentType === "pdf" ? file : null}
                        pdfId={contentId}
                        userId={userId}
                        contentType={contentType}
                      />
                    </>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
