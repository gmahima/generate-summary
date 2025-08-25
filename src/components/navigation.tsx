"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center space-x-4 mb-6">
      <Link
        href="/chat"
        className={`px-3 py-2 rounded-md ${
          pathname === "/chat"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted"
        }`}
      >
        vREST Chat
      </Link>
      <Link
        href="/openai"
        className={`px-3 py-2 rounded-md ${
          pathname === "/openai"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted"
        }`}
      >
        OpenAI Chat
      </Link>
    </nav>
  );
}
