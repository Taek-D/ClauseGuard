import type { Metadata } from "next";

import { AppBootstrap } from "@/components/layout/AppBootstrap";

import "./globals.css";

export const metadata: Metadata = {
  title: "ClauseGuard",
  description:
    "Supabase-first MVP workspace for AI contract review, analysis progress, and risk reporting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <body className="min-h-screen bg-[var(--cg-surface)] text-slate-950 antialiased">
        <AppBootstrap />
        {children}
      </body>
    </html>
  );
}
