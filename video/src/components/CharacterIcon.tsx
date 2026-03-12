import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BG_CARD, BORDER_CARD, TEXT_PRIMARY, TEXT_SECONDARY, BTC_ORANGE, BLUE_ACTIVE } from "../lib/colors";
import { SMOOTH } from "../lib/springs";
import { fadeIn } from "../lib/animations";

export const CharacterIcon: React.FC<{
  type: "depositor" | "buyer";
  startFrame?: number;
  fromDirection?: "left" | "right";
}> = ({ type, startFrame = 0, fromDirection = "left" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const s = spring({ fps, frame: f, config: SMOOTH });
  const slideX = (1 - s) * (fromDirection === "left" ? -200 : 200);
  const opacity = fadeIn(frame, startFrame, 15);

  const isDepositor = type === "depositor";
  const color = isDepositor ? BTC_ORANGE : BLUE_ACTIVE;
  const emoji = isDepositor ? "🏦" : "📊";
  const label = isDepositor ? "Vault Depositor" : "Option Buyer";
  const sublabel = isDepositor ? "Earns yield passively" : "Speculates on price";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        opacity,
        transform: `translateX(${slideX}px)`,
      }}
    >
      <div
        style={{
          width: 100,
          height: 100,
          borderRadius: "50%",
          background: BG_CARD,
          border: `3px solid ${color}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 44,
          boxShadow: `0 0 20px ${color}33`,
        }}
      >
        {emoji}
      </div>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: 18,
          fontWeight: "bold",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: TEXT_SECONDARY,
          fontSize: 14,
          fontFamily: "Inter, sans-serif",
        }}
      >
        {sublabel}
      </div>
    </div>
  );
};
