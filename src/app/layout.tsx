import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

// Page title and description shown in the browser tab.
export const metadata: Metadata = {
  title: "Approvals Assistant",
  description: "AI-assisted review of pending patrol content approvals",
};

// Wraps every page.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
