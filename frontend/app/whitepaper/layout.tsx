import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Whitepaper",
  description:
    "sBTC Options Vault Whitepaper — Bitcoin yield through automated covered call options on Stacks. Technical architecture, tokenomics, and roadmap.",
  openGraph: {
    title: "sBTC Options Vault — Whitepaper",
    description:
      "Bitcoin yield through automated covered call options on Stacks blockchain.",
  },
};

export default function WhitepaperLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
