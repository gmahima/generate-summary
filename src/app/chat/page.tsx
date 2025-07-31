import { GeneralChat } from "@/components/general-chat";

export default function ChatPage() {
  return (
    <main className="container mx-auto p-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Chat with AI</h1>
        <GeneralChat />
      </div>
    </main>
  );
}
