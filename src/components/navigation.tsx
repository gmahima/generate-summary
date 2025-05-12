"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center space-x-4 mb-6">
      <Link
        href="/"
        className={`px-3 py-2 rounded-md ${
          pathname === "/"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted"
        }`}
      >
        PDF Chat
      </Link>
      <Link
        href="/calculator"
        className={`px-3 py-2 rounded-md ${
          pathname === "/calculator"
            ? "bg-primary text-primary-foreground"
            : "hover:bg-muted"
        }`}
      >
        Calculator
      </Link>
    </nav>
  );
}
