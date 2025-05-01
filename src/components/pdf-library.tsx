"use client";

import { useState, useEffect } from "react";
import { fetchUserPdfs } from "@/lib/rag-service";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type PDF = {
  id: string;
  name: string;
  created_at: string;
};

interface PdfLibraryProps {
  onSelectPdf: (id: string, name: string) => void;
}

/**
 * PDF Library Component
 *
 * Displays a list of previously uploaded PDFs and allows the user to select one
 * to chat with without re-embedding.
 */
export function PdfLibrary({ onSelectPdf }: PdfLibraryProps) {
  const [pdfs, setPdfs] = useState<PDF[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPdfs() {
      try {
        setIsLoading(true);
        setError(null);
        const userPdfs = await fetchUserPdfs();
        setPdfs(userPdfs);
      } catch (err) {
        console.error("Failed to load PDFs:", err);
        setError("Unable to load your PDFs. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    }

    loadPdfs();
  }, []);

  // Format the date to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Your PDF Library</CardTitle>
        <CardDescription>
          Select a previously uploaded PDF to chat with it
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : error ? (
          <p className="text-destructive text-center py-4">{error}</p>
        ) : pdfs.length === 0 ? (
          <p className="text-center py-6 text-muted-foreground">
            You haven&apos;t uploaded any PDFs yet. Upload your first PDF to get
            started!
          </p>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-4">
              {pdfs.map((pdf) => (
                <div
                  key={pdf.id}
                  className="flex items-center justify-between border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{pdf.name}</span>
                    <span className="text-sm text-muted-foreground">
                      Uploaded on {formatDate(pdf.created_at)}
                    </span>
                  </div>
                  <Button onClick={() => onSelectPdf(pdf.id, pdf.name)}>
                    Chat
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
