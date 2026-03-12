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

const SITE_URL = "https://sbtc-options-vault.vercel.app";
const SITE_NAME = "sBTC Options Vault";
const SITE_DESCRIPTION =
  "Earn yield on your sBTC through automated covered call options. The first options vault on Stacks/Bitcoin.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "sBTC Options Vault | Covered Call Yield on Bitcoin",
    template: "%s | sBTC Options Vault",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "sBTC",
    "Bitcoin",
    "options vault",
    "covered call",
    "DeFi",
    "yield",
    "Stacks",
    "STX",
    "options trading",
    "Bitcoin DeFi",
    "BTC yield",
    "covered call strategy",
  ],
  authors: [{ name: "sBTC Options Vault Team" }],
  creator: "sBTC Options Vault",
  publisher: "sBTC Options Vault",
  applicationName: SITE_NAME,
  category: "DeFi",
  openGraph: {
    title: SITE_NAME,
    description:
      "Earn yield on your sBTC through automated covered call options on Stacks.",
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description:
      "Earn yield on your sBTC through automated covered call options. The first options vault on Stacks/Bitcoin.",
    creator: "@sBTCOptionsVault",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/logo-480.png", sizes: "480x480", type: "image/png" },
    ],
    apple: [{ url: "/logo-480.png", sizes: "480x480", type: "image/png" }],
  },
  manifest: "/manifest.json",
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      category: "DeFi Yield",
    },
    creator: {
      "@type": "Organization",
      name: "sBTC Options Vault Team",
    },
  };

  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <meta name="theme-color" content="#f97316" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen`}
      >
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
