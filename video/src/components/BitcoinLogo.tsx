import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BTC_ORANGE, GOLD } from "../lib/colors";
import { BOUNCY } from "../lib/springs";
import { pulse } from "../lib/animations";

export const BitcoinLogo: React.FC<{
  size?: number;
  startFrame?: number;
}> = ({ size = 200, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const scale = spring({ fps, frame: f, config: BOUNCY });
  const glowRadius = interpolate(f, [0, 60], [0, 40], {
    extrapolateRight: "clamp",
  });
  const p = pulse(frame, 0.03, 0.03);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${GOLD}, ${BTC_ORANGE})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: `scale(${scale * p})`,
        boxShadow: `0 0 ${glowRadius}px ${glowRadius / 2}px ${BTC_ORANGE}88`,
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 64 64">
        <text
          x="32"
          y="46"
          textAnchor="middle"
          fill="white"
          fontSize="48"
          fontWeight="bold"
          fontFamily="Inter, sans-serif"
        >
          ₿
        </text>
      </svg>
    </div>
  );
};
