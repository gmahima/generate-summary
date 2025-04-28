"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { SummaryOutput } from "@/components/summary-output";
import { Button } from "@/components/button";
import { generateSummary } from "@/lib/summary-service";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setSummary(null);
  };

  const handleGenerateSummary = async () => {
    if (!file) {
      toast.error("Please upload a PDF file first");
      return;
    }

    try {
      setIsLoading(true);
      
      // Create FormData to pass to server action
      const formData = new FormData();
      formData.append('file', file);
      
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

  return (
    <div className="min-h-screen p-6 md:p-12">
      <Toaster position="top-right" />
      <div className="max-w-4xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold mb-2">PDF Summary Generator</h1>
          <p className="text-muted-foreground">Upload a PDF and generate an AI-powered summary</p>
        </header>

        <div className="grid gap-8">
          <FileUpload onFileChange={handleFileChange} />
          
          <div className="flex justify-center">
            <Button 
              onClick={handleGenerateSummary}
              disabled={!file || isLoading}
              className="w-full max-w-[200px]"
            >
              {isLoading ? "Generating..." : "Generate Summary"}
            </Button>
          </div>

          <SummaryOutput summary={summary} isLoading={isLoading} />
        </div>
      </div>
    </div>
  );
}
