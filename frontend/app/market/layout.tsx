import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Options Market",
  description:
    "Browse and purchase Bitcoin covered call options on the sBTC Options Vault. View available strikes, premiums, and expiry dates.",
  openGraph: {
    title: "Options Market | sBTC Options Vault",
    description:
      "Browse and purchase Bitcoin covered call options. View available strikes, premiums, and expiry dates.",
  },
};

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
