import { interpolate, useCurrentFrame } from "remotion";
import { BTC_ORANGE, GOLD, BG_CARD, BORDER_CARD, TEXT_PRIMARY, TEXT_SECONDARY } from "../lib/colors";
import { fadeIn } from "../lib/animations";

export const CoinPipeline: React.FC<{
  startFrame?: number;
  duration?: number;
  fromLabel?: string;
  toLabel?: string;
  pipelineLabel?: string;
  width?: number;
}> = ({
  startFrame = 0,
  duration = 90,
  fromLabel = "Wallet",
  toLabel = "Vault",
  pipelineLabel = "Stacks Blockchain",
  width = 800,
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - startFrame);

  if (f < 0) return null;

  const pipeOpacity = fadeIn(frame, startFrame, 15);
  const coinProgress = interpolate(f, [15, duration - 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const coinX = interpolate(coinProgress, [0, 1], [40, width - 80]);
  const labelOpacity = fadeIn(frame, startFrame + 10, 15);

  // Trail particles
  const trails = Array.from({ length: 5 }, (_, i) => {
    const trailProgress = Math.max(0, coinProgress - i * 0.04);
    const trailX = interpolate(trailProgress, [0, 1], [40, width - 80]);
    const trailOpacity = interpolate(i, [0, 4], [0.6, 0.1]);
    return { x: trailX, opacity: trailOpacity, size: 30 - i * 4 };
  });

  return (
    <div style={{ position: "relative", width, height: 160, opacity: pipeOpacity }}>
      {/* From icon */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 30,
          width: 60,
          height: 60,
          borderRadius: 12,
          background: BG_CARD,
          border: `1px solid ${BORDER_CARD}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
        }}
      >
        💼
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 95,
          width: 60,
          textAlign: "center",
          color: TEXT_SECONDARY,
          fontSize: 14,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {fromLabel}
      </div>

      {/* Pipeline tube */}
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 48,
          width: width - 140,
          height: 24,
          borderRadius: 12,
          background: `linear-gradient(90deg, ${BG_CARD}, ${BORDER_CARD}, ${BG_CARD})`,
          border: `1px solid ${BORDER_CARD}`,
          overflow: "hidden",
        }}
      >
        {/* Glow following coin */}
        <div
          style={{
            position: "absolute",
            left: coinX - 70,
            top: -10,
            width: 80,
            height: 44,
            borderRadius: 22,
            background: `radial-gradient(ellipse, ${BTC_ORANGE}44, transparent)`,
          }}
        />
      </div>

      {/* Pipeline label */}
      <div
        style={{
          position: "absolute",
          left: 70,
          top: 10,
          width: width - 140,
          textAlign: "center",
          color: TEXT_SECONDARY,
          fontSize: 16,
          fontFamily: "Inter, sans-serif",
          opacity: labelOpacity,
          letterSpacing: 2,
          textTransform: "uppercase",
        }}
      >
        {pipelineLabel}
      </div>

      {/* Trail particles */}
      {trails.map((trail, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: trail.x,
            top: 60 - trail.size / 2,
            width: trail.size,
            height: trail.size,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${GOLD}${Math.floor(trail.opacity * 255).toString(16).padStart(2, "0")}, transparent)`,
          }}
        />
      ))}

      {/* Main coin */}
      <div
        style={{
          position: "absolute",
          left: coinX,
          top: 35,
          width: 50,
          height: 50,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${GOLD}, ${BTC_ORANGE})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 20px ${BTC_ORANGE}88`,
          border: "2px solid rgba(255,255,255,0.3)",
          fontSize: 22,
          fontWeight: "bold",
          color: "white",
          fontFamily: "Inter, sans-serif",
        }}
      >
        ₿
      </div>

      {/* To icon */}
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 30,
          width: 60,
          height: 60,
          borderRadius: 12,
          background: BG_CARD,
          border: `1px solid ${BTC_ORANGE}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
        }}
      >
        🏦
      </div>
      <div
        style={{
          position: "absolute",
          right: 0,
          top: 95,
          width: 60,
          textAlign: "center",
          color: TEXT_SECONDARY,
          fontSize: 14,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {toLabel}
      </div>
    </div>
  );
};
