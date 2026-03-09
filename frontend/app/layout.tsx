import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayout from "@/components/layout/ClientLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "sBTC Options Vault | Covered Call Yield on Bitcoin",
  description:
    "Earn yield on your sBTC through automated covered call options. The first options vault on Stacks/Bitcoin.",
  openGraph: {
    title: "sBTC Options Vault",
    description: "Earn yield on your sBTC through automated covered call options on Stacks.",
    type: "website",
  },
  other: {
    "talentapp:project_verification":
      "c0b7f328f613c2a3bc4229784989e0ce926f9610c2e81670b38fad86aac75a7fe29d1aacb32221163fb2b51c208a30ce520be1ff715786b11ef9ceb56b905400",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head />
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
