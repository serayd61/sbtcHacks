import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "sBTC Options Vault — Covered Call Yield on Bitcoin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function TwitterImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0a0a14 0%, #1a1a2e 50%, #0a0a14 100%)",
          fontFamily: "system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "linear-gradient(rgba(249,115,22,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            display: "flex",
          }}
        />

        {/* Center glow */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)",
            transform: "translate(-50%, -50%)",
            display: "flex",
          }}
        />

        {/* BTC symbol */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 100,
            height: 100,
            borderRadius: "50%",
            border: "3px solid rgba(249,115,22,0.6)",
            background: "rgba(249,115,22,0.08)",
            marginBottom: 20,
            fontSize: 50,
            fontWeight: 800,
            color: "#f97316",
          }}
        >
          B
        </div>

        <div
          style={{
            fontSize: 52,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-1px",
            display: "flex",
          }}
        >
          sBTC Options Vault
        </div>

        <div
          style={{
            fontSize: 24,
            color: "#f97316",
            fontWeight: 600,
            letterSpacing: "3px",
            textTransform: "uppercase" as const,
            marginTop: 8,
            display: "flex",
          }}
        >
          Earn Yield on Bitcoin with Covered Calls
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #f97316, #fbbf24, #f97316)",
            display: "flex",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
