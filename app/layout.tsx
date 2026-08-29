import type { Metadata } from "next";
import { Bricolage_Grotesque, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";

const bricolageGrotesque = Bricolage_Grotesque({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Used for exactly one label in the design (the sidebar's "AI Teacher's
// Toolkit" button) — every other piece of text uses Bricolage Grotesque.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  title: "VedaAI — AI Teacher's Toolkit",
  description: "Upload a question paper and a student's answer sheet to extract, map, and grade answers automatically.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${bricolageGrotesque.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">{children}</body>
    </html>
  );
}
