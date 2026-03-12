import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import {
  ACCENT_ORANGE,
  ACCENT_ORANGE_DARK,
  BG_CARD,
  BORDER_CARD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  GREEN_ITM,
} from "../lib/colors";
import { SNAPPY } from "../lib/springs";
import { fadeIn } from "../lib/animations";

export const OptionCard: React.FC<{
  startFrame?: number;
  strikePrice?: string;
  premium?: string;
  collateral?: string;
  optionId?: number;
  highlighted?: boolean;
}> = ({
  startFrame = 0,
  strikePrice = "$90,000",
  premium = "0.05 sBTC",
  collateral = "5 sBTC",
  optionId = 12,
  highlighted = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const scale = spring({ fps, frame: f, config: SNAPPY });
  const opacity = fadeIn(frame, startFrame, 10);

  return (
    <div
      style={{
        width: 340,
        padding: 28,
        borderRadius: 16,
        background: BG_CARD,
        border: `1px solid ${highlighted ? ACCENT_ORANGE : BORDER_CARD}`,
        opacity,
        transform: `scale(${scale}) translateY(${(1 - scale) * 40}px)`,
        boxShadow: highlighted
          ? `0 0 30px ${ACCENT_ORANGE}33`
          : "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <span style={{ fontSize: 20 }}>📈</span>
        <span
          style={{
            color: TEXT_PRIMARY,
            fontSize: 20,
            fontWeight: "bold",
            fontFamily: "Inter, sans-serif",
          }}
        >
          CALL OPTION #{optionId}
        </span>
      </div>

      {[
        { label: "Strike Price", value: strikePrice },
        { label: "Premium", value: premium },
        { label: "Collateral", value: collateral },
      ].map(({ label, value }) => (
        <div
          key={label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 12,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <span style={{ color: TEXT_SECONDARY, fontSize: 16 }}>{label}</span>
          <span style={{ color: TEXT_PRIMARY, fontSize: 16, fontWeight: 600 }}>
            {value}
          </span>
        </div>
      ))}

      <div
        style={{
          marginTop: 20,
          padding: "12px 24px",
          borderRadius: 10,
          background: `linear-gradient(135deg, ${ACCENT_ORANGE}, ${ACCENT_ORANGE_DARK})`,
          textAlign: "center",
          color: "white",
          fontSize: 16,
          fontWeight: "bold",
          fontFamily: "Inter, sans-serif",
          cursor: "pointer",
        }}
      >
        BUY OPTION
      </div>
    </div>
  );
};
