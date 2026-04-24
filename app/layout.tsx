import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Sooko DevOS — The Trust Layer for AI-Generated Software Work",
  description:
    "Sooko DevOS adds a trust layer to Copilot-powered software work by planning, reviewing, validating, and summarizing every task with multi-model intelligence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${dmSans.variable} ${jetbrains.variable} font-sans min-h-screen bg-surface-0`}
      >
        {children}
      </body>
    </html>
  );
}
