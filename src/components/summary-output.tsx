"use client";

import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

interface SummaryOutputProps {
  summary: string | null;
  isLoading: boolean;
}

export function SummaryOutput({ summary, isLoading }: SummaryOutputProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Summary</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : summary ? (
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            {summary.split('\n').map((paragraph, index) => (
              paragraph ? <p key={index}>{paragraph}</p> : <br key={index} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-center h-40 flex items-center justify-center">
            Summary will appear here after generation
          </p>
        )}
      </CardContent>
    </Card>
  );
} 