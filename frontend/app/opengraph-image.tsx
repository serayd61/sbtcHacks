import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "sBTC Options Vault — Covered Call Yield on Bitcoin";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
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
        {/* Grid pattern overlay */}
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

        {/* Glow effect */}
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

        {/* Bitcoin symbol */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            borderRadius: "50%",
            border: "3px solid rgba(249,115,22,0.6)",
            background: "rgba(249,115,22,0.08)",
            marginBottom: 24,
            fontSize: 60,
            fontWeight: 800,
            color: "#f97316",
          }}
        >
          B
        </div>

        {/* Title */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              fontSize: 56,
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
              fontSize: 26,
              color: "#f97316",
              fontWeight: 600,
              letterSpacing: "4px",
              textTransform: "uppercase" as const,
              display: "flex",
            }}
          >
            Covered Call Yield on Bitcoin
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display: "flex",
            gap: 48,
            marginTop: 40,
            alignItems: "center",
          }}
        >
          {[
            { label: "Strategy", value: "Covered Calls" },
            { label: "Asset", value: "sBTC" },
            { label: "Network", value: "Stacks / Bitcoin" },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#ffffff",
                  display: "flex",
                }}
              >
                {stat.value}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: "#9ca3af",
                  textTransform: "uppercase" as const,
                  letterSpacing: "2px",
                  display: "flex",
                }}
              >
                {stat.label}
              </div>
            </div>
          ))}
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

        {/* Powered by */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            right: 40,
            fontSize: 14,
            color: "#6b7280",
            display: "flex",
          }}
        >
          Powered by Stacks & Bitcoin
        </div>
      </div>
    ),
    { ...size }
  );
}
