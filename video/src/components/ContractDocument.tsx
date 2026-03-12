import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { BG_CARD, BORDER_CARD, BTC_ORANGE, TEXT_PRIMARY, TEXT_SECONDARY, GOLD } from "../lib/colors";
import { SMOOTH } from "../lib/springs";
import { fadeIn } from "../lib/animations";

export const ContractDocument: React.FC<{
  startFrame?: number;
}> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const heightScale = spring({ fps, frame: f, config: SMOOTH });
  const opacity = fadeIn(frame, startFrame, 15);

  const terms = [
    { icon: "🎯", label: "Strike Price", value: "$90,000", delay: 30 },
    { icon: "💰", label: "Premium", value: "0.05 sBTC", delay: 60 },
    { icon: "⏱️", label: "Expiry", value: "7 days", delay: 90 },
  ];

  return (
    <div
      style={{
        width: 300,
        padding: 24,
        borderRadius: 16,
        background: BG_CARD,
        border: `2px solid ${BTC_ORANGE}88`,
        opacity,
        transform: `scaleY(${heightScale})`,
        transformOrigin: "top center",
        boxShadow: `0 0 30px ${BTC_ORANGE}22`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          textAlign: "center",
          color: GOLD,
          fontSize: 18,
          fontWeight: "bold",
          fontFamily: "Inter, sans-serif",
          marginBottom: 20,
          letterSpacing: 1,
        }}
      >
        CALL OPTION CONTRACT
      </div>

      {terms.map(({ icon, label, value, delay }) => {
        const termOpacity = fadeIn(frame, startFrame + delay, 15);
        const termScale = spring({
          fps,
          frame: Math.max(0, f - delay),
          config: { damping: 12, mass: 0.5, stiffness: 120 },
        });

        return (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
              opacity: termOpacity,
              transform: `scale(${termScale})`,
              transformOrigin: "left center",
            }}
          >
            <span style={{ fontSize: 22 }}>{icon}</span>
            <div>
              <div
                style={{
                  color: TEXT_SECONDARY,
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  color: TEXT_PRIMARY,
                  fontSize: 18,
                  fontWeight: "bold",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {value}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
