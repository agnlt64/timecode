import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/app/components/nav-bar";

export const metadata: Metadata = {
  title: "Timecode",
  description: "Coding time tracker"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
        />
      </head>
      <body>
        <div className="min-h-screen" style={{ background: "#111113" }}>
          <header className="border-b border-border">
            <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
              <span className="text-lg font-semibold tracking-tight">Timecode</span>
              <NavBar />
            </div>
          </header>
          <main className="mx-auto max-w-5xl px-4 py-6 space-y-5">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
