import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GREEN_ITM, TEXT_PRIMARY, BG_CARD } from "../lib/colors";
import { BOUNCY } from "../lib/springs";
import { fadeIn } from "../lib/animations";

export const ShieldIcon: React.FC<{
  startFrame?: number;
  text?: string;
  color?: string;
}> = ({ startFrame = 0, text = "MAX LOSS = 0.05 sBTC", color = GREEN_ITM }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const scale = spring({ fps, frame: f, config: BOUNCY });
  const opacity = fadeIn(frame, startFrame, 15);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <svg width={120} height={140} viewBox="0 0 120 140">
        <path
          d="M60 10 L110 35 L110 80 Q110 120 60 135 Q10 120 10 80 L10 35 Z"
          fill={BG_CARD}
          stroke={color}
          strokeWidth={3}
        />
        <text
          x="60"
          y="75"
          textAnchor="middle"
          fill={color}
          fontSize="40"
          fontWeight="bold"
        >
          ✓
        </text>
      </svg>
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: 18,
          fontWeight: "bold",
          fontFamily: "Inter, sans-serif",
          textAlign: "center",
          padding: "8px 16px",
          background: `${color}15`,
          borderRadius: 8,
          border: `1px solid ${color}44`,
        }}
      >
        {text}
      </div>
    </div>
  );
};
