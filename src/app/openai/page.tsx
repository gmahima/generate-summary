import { OpenAIChat } from "@/components/openai-chat";

export default function OpenAIPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="w-full max-w-4xl">
        <OpenAIChat />
      </div>
    </main>
  );
}
