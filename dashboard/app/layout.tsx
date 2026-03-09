import type { Metadata } from "next";
import "./globals.css";
import { Space_Grotesk } from "next/font/google";

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
          {children}
        </div>
      </body>
    </html>
  );
}
