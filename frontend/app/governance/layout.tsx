import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Governance",
  description:
    "Vote on sBTC Options Vault proposals, manage protocol parameters, and participate in decentralized governance on Stacks.",
  openGraph: {
    title: "Governance | sBTC Options Vault",
    description:
      "Vote on protocol proposals and participate in decentralized governance for the sBTC Options Vault.",
  },
};

export default function GovernanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
