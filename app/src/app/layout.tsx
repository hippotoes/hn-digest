import type { Metadata } from "next";
import { Playfair_Display, Source_Serif_4, DM_Mono } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({ subsets: ["latin"], variable: '--font-playfair' });
const sourceSerif = Source_Serif_4({ subsets: ["latin"], variable: '--font-source-serif' });
const dmMono = DM_Mono({ weight: ['400', '500'], subsets: ["latin"], variable: '--font-dm-mono' });

export const metadata: Metadata = {
  title: "HN Digest",
  description: "AI-powered Hacker News intelligence briefing",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${playfair.variable} ${sourceSerif.variable} ${dmMono.variable}`}>
      <body className="antialiased font-serif">
        {children}
      </body>
    </html>
  );
}
