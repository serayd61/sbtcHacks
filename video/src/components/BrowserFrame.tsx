import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BG_CARD, BORDER_CARD, TEXT_SECONDARY } from "../lib/colors";
import { SMOOTH } from "../lib/springs";

export const BrowserFrame: React.FC<{
  startFrame?: number;
  url?: string;
  children: React.ReactNode;
  width?: number;
  height?: number;
}> = ({
  startFrame = 0,
  url = "sbtc-vault.app",
  children,
  width = 1100,
  height = 650,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const slideUp = (1 - spring({ fps, frame: f, config: SMOOTH })) * 100;

  return (
    <div
      style={{
        width,
        borderRadius: 16,
        overflow: "hidden",
        background: "#111",
        border: `1px solid ${BORDER_CARD}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        transform: `translateY(${slideUp}px)`,
      }}
    >
      {/* Title bar */}
      <div
        style={{
          height: 40,
          background: BG_CARD,
          display: "flex",
          alignItems: "center",
          padding: "0 16px",
          gap: 8,
          borderBottom: `1px solid ${BORDER_CARD}`,
        }}
      >
        {/* Traffic lights */}
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ff5f57" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#febc2e" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28c840" }} />

        {/* URL bar */}
        <div
          style={{
            marginLeft: 16,
            flex: 1,
            height: 26,
            borderRadius: 6,
            background: "#0a0a0a",
            display: "flex",
            alignItems: "center",
            padding: "0 12px",
          }}
        >
          <span style={{ fontSize: 12, marginRight: 4 }}>🔒</span>
          <span
            style={{
              color: TEXT_SECONDARY,
              fontSize: 13,
              fontFamily: "Inter, sans-serif",
            }}
          >
            {url}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          height: height - 40,
          background: "#0a0a0a",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {children}
      </div>
    </div>
  );
};
