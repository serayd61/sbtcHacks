import { spring, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { BOUNCY } from "../lib/springs";
import { BTC_ORANGE } from "../lib/colors";
import { fadeIn } from "../lib/animations";

export const VaultLogo: React.FC<{
  size?: number;
  startFrame?: number;
}> = ({ size = 300, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const scale = spring({ fps, frame: f, config: BOUNCY });
  const opacity = fadeIn(frame, startFrame, 20);
  const glow = spring({ fps, frame: Math.max(0, f - 15), config: { damping: 20, mass: 1, stiffness: 60 } });

  return (
    <div
      style={{
        opacity,
        transform: `scale(${scale})`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `radial-gradient(circle at 40% 40%, #1a1a2e, #0a0a0a)`,
          border: `3px solid ${BTC_ORANGE}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 ${glow * 60}px ${glow * 20}px ${BTC_ORANGE}44`,
          overflow: "hidden",
        }}
      >
        {/* Vault door icon */}
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 100 100">
          <rect
            x="15"
            y="20"
            width="70"
            height="65"
            rx="8"
            fill="none"
            stroke={BTC_ORANGE}
            strokeWidth="4"
          />
          <circle cx="50" cy="52" r="15" fill="none" stroke={BTC_ORANGE} strokeWidth="3" />
          <circle cx="50" cy="52" r="5" fill={BTC_ORANGE} />
          <line x1="50" y1="37" x2="50" y2="20" stroke={BTC_ORANGE} strokeWidth="3" />
          <rect x="35" y="10" width="30" height="14" rx="4" fill="none" stroke={BTC_ORANGE} strokeWidth="3" />
        </svg>
      </div>
    </div>
  );
};
