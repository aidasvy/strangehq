import type { Metadata } from "next";
import { Geist, Geist_Mono, Big_Shoulders } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const shoulders = Big_Shoulders({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-shoulders" });

export const metadata: Metadata = {
  title: "StrangeHQ",
  description: "Scheduling, time tracking, and payroll for shift-based teams.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${shoulders.variable} h-full antialiased`}>
      <body className="min-h-full bg-[#FAFAFA] text-stone-900">
        {children}
      </body>
    </html>
  );
}
