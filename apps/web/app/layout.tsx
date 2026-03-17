import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Banklens Nigeria — Bank Statement Tax Analyzer",
  description:
    "Simplify your self-assessment tax returns. Upload bank statements, annotate transactions, and compute your PITA tax liability with ease.",
  keywords: [
    "tax",
    "nigeria",
    "PITA",
    "self-assessment",
    "bank statement",
    "FIRS",
    "tax computation",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${geist.variable} antialiased`} style={{ margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
