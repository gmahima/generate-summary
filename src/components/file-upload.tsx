"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Card, CardContent } from "./ui/card";

interface FileUploadProps {
  onFileChange: (file: File | null) => void;
}

export function FileUpload({ onFileChange }: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      if (file.type !== 'application/pdf') {
        alert('Please upload a PDF file');
        e.target.value = '';
        setFileName(null);
        onFileChange(null);
        return;
      }
      setFileName(file.name);
      onFileChange(file);
    } else {
      setFileName(null);
      onFileChange(null);
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="pt-6">
        <div className="grid w-full items-center gap-4">
          <div className="flex flex-col space-y-2">
            <Label htmlFor="file">Upload PDF</Label>
            <Input 
              id="file" 
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {fileName && (
              <p className="text-sm text-muted-foreground mt-2">
                Selected: {fileName}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
} 