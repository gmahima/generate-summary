"use client";

import { CalculatorInterface } from "@/components/calculator-interface";
import { Navigation } from "@/components/navigation";

export default function CalculatorPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold mb-2">AI Calculator</h1>
          <p className="text-gray-500">
            Powered by Google Gemini AI, this calculator can handle a wide range
            of mathematical operations.
          </p>
        </div>

        <Navigation />

        <CalculatorInterface />
      </div>
    </div>
  );
}
