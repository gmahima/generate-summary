"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { SummaryOutput } from "@/components/summary-output";
import { Button } from "@/components/button";
import { generateSummary } from "@/lib/summary-service";
import { processPdf } from "@/lib/rag-service";
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

/**
 * Home Page Component
 *
 * This is the main page of the application that provides:
 * 1. PDF upload functionality
 * 2. PDF summarization
 * 3. Chat interface for querying the PDF using RAG
 *
 * The component manages the state for the uploaded file,
 * summary generation, and integrates with the RAG system.
 */
export default function Home() {
  // State for the uploaded PDF file
  const [file, setFile] = useState<File | null>(null);

  // State for the generated summary
  const [summary, setSummary] = useState<string | null>(null);

  // State for loading indicators
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // State for language selection
  const [language, setLanguage] = useState<SupportedLanguage>("english");

  // State for the processed PDF ID (for RAG)
  const [pdfId, setPdfId] = useState<string | null>(null);

  // State for selected PDF name (for display)
  const [selectedPdfName, setSelectedPdfName] = useState<string | null>(null);

  // Using the imported TEMPORARY_USER_ID constant instead of hardcoding
  const userId = TEMPORARY_USER_ID;

  /**
   * Handle file upload
   * When a new file is uploaded, reset the summary and pdfId
   */
  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setSummary(null);
    setPdfId(null);
    setSelectedPdfName(selectedFile?.name || null);
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
      setPdfId(result.pdfId);

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
   * Generate a summary of the PDF
   * This uses the summary service to generate a summary
   */
  const handleGenerateSummary = async () => {
    // Check if we have either a file or a PDF ID
    if (!file && !pdfId) {
      toast.error("Please upload or select a PDF first");
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

      // If we have a PDF ID, use that (for library PDFs)
      if (pdfId) {
        formData.append("pdfId", pdfId);
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
    setPdfId(id);
    setSelectedPdfName(name);
    // We're using an existing PDF, so we don't have the File object
    setFile(null);
    toast.success(`Selected "${name}" for chat`);
  };

  return (
    <div className="min-h-screen p-6 md:p-12">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">PDF Assistant</h1>
          <p className="text-muted-foreground">
            Upload a PDF to generate summaries and chat with your document
          </p>
        </header>

        <div className="grid gap-8">
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

          {(file || pdfId) && (
            <Tabs defaultValue="chat">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                <TabsTrigger value="summary">Generate Summary</TabsTrigger>
                <TabsTrigger value="chat">Chat with PDF</TabsTrigger>
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
                      disabled={!(file || pdfId) || isLoading}
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
                  {!pdfId && file && (
                    <div className="flex flex-col items-center gap-4">
                      <p className="text-center text-muted-foreground">
                        To chat with your PDF, it needs to be processed first.
                        This extracts the text, splits it into chunks, and
                        generates embeddings for search.
                      </p>
                      <Button
                        onClick={handleProcessPDF}
                        disabled={!file || isProcessing}
                        className="w-full max-w-[200px]"
                      >
                        {isProcessing
                          ? "Processing..."
                          : "Process PDF for Chat & Summary"}
                      </Button>
                    </div>
                  )}

                  {pdfId && (
                    <>
                      {selectedPdfName && (
                        <div className="border rounded-lg p-4 bg-muted/50">
                          <h3 className="font-medium">
                            Currently chatting with:
                          </h3>
                          <p className="text-sm">{selectedPdfName}</p>
                        </div>
                      )}
                      <ChatInterface
                        pdfFile={file}
                        pdfId={pdfId}
                        userId={userId}
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
