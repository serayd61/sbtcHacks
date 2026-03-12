import React from "react";
import { BG_CARD, BORDER_CARD, TEXT_PRIMARY, TEXT_SECONDARY, ACCENT_ORANGE, BTC_ORANGE } from "../lib/colors";
import { fadeIn } from "../lib/animations";
import { useCurrentFrame } from "remotion";

export const NavBar: React.FC<{
  startFrame?: number;
  activeTab?: string;
}> = ({ startFrame = 0, activeTab = "Dashboard" }) => {
  const frame = useCurrentFrame();
  const opacity = fadeIn(frame, startFrame, 15);

  const tabs = ["Dashboard", "Market", "Governance", "Admin"];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 24px",
        background: BG_CARD,
        borderBottom: `1px solid ${BORDER_CARD}`,
        opacity,
      }}
    >
      {/* Logo area */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 40 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${BTC_ORANGE}, ${ACCENT_ORANGE})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            color: "white",
            fontWeight: "bold",
          }}
        >
          ₿
        </div>
        <span
          style={{
            color: TEXT_PRIMARY,
            fontSize: 16,
            fontWeight: "bold",
            fontFamily: "Inter, sans-serif",
          }}
        >
          sBTC Vault
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4 }}>
        {tabs.map((tab) => (
          <div
            key={tab}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: tab === activeTab ? `${ACCENT_ORANGE}22` : "transparent",
              color: tab === activeTab ? ACCENT_ORANGE : TEXT_SECONDARY,
              fontSize: 14,
              fontWeight: tab === activeTab ? 600 : 400,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {tab}
          </div>
        ))}
      </div>

      {/* Connect button area */}
      <div style={{ marginLeft: "auto" }}>
        <div
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: `linear-gradient(135deg, ${ACCENT_ORANGE}, ${BTC_ORANGE})`,
            color: "white",
            fontSize: 14,
            fontWeight: 600,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Connect Wallet
        </div>
      </div>
    </div>
  );
};
