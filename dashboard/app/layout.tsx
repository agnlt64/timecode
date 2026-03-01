import type { Metadata } from "next";
import "./globals.css";
import { NavBar } from "@/app/components/nav-bar";
import { Space_Grotesk } from "next/font/google" 

const spaceGrotesk = Space_Grotesk()

export const metadata: Metadata = {
  title: "Timecode",
  description: "Coding time tracker",
  icons: {
    icon: '/favicon.svg',
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={spaceGrotesk.className}>
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
