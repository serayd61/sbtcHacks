import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof globalThis.Buffer === 'undefined') {
                globalThis.Buffer = { isBuffer: function() { return false; }, from: function() { return []; }, alloc: function() { return []; } };
              }
              if (typeof globalThis.process === 'undefined') {
                globalThis.process = { env: {}, version: '', browser: true };
              }
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-black text-white min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}
