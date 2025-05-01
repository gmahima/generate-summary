"use client";

import { useState } from "react";
import { FileUpload } from "@/components/file-upload";
import { SummaryOutput } from "@/components/summary-output";
import { Button } from "@/components/button";
import { generateSummary } from "@/lib/summary-service";
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

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [language, setLanguage] = useState<SupportedLanguage>("english");

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setSummary(null);
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value as SupportedLanguage);
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
      formData.append("file", file);
      formData.append("language", language);

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
          <h1 className="text-3xl font-bold mb-2">PDF Assistant</h1>
          <p className="text-muted-foreground">
            Upload a PDF to generate summaries and chat with your document
          </p>
        </header>

        <div className="grid gap-8">
          <FileUpload onFileChange={handleFileChange} />

          {file && (
            <Tabs defaultValue="summary">
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
                      disabled={!file || isLoading}
                      className="w-full max-w-[200px]"
                    >
                      {isLoading ? "Generating..." : "Generate Summary"}
                    </Button>
                  </div>

                  <SummaryOutput summary={summary} isLoading={isLoading} />
                </div>
              </TabsContent>

              <TabsContent value="chat" className="mt-6">
                <ChatInterface pdfFile={file} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
