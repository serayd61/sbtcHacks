import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { GREEN_ITM, ORANGE_OTM, TEXT_PRIMARY } from "../lib/colors";
import { SNAPPY } from "../lib/springs";
import { pulse } from "../lib/animations";

export const StatusBadge: React.FC<{
  status: "itm" | "otm" | "active" | "expired";
  startFrame?: number;
}> = ({ status, startFrame = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const scale = spring({ fps, frame: f, config: SNAPPY });
  const p = pulse(frame, 0.04, 0.04);

  const configs = {
    itm: { bg: GREEN_ITM, label: "IN THE MONEY 📈", glow: GREEN_ITM },
    otm: { bg: ORANGE_OTM, label: "OUT OF THE MONEY 📉", glow: ORANGE_OTM },
    active: { bg: "#3b82f6", label: "ACTIVE", glow: "#3b82f6" },
    expired: { bg: "#6b7280", label: "EXPIRED ⏱️", glow: "#6b7280" },
  };

  const config = configs[status];

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "8px 20px",
        borderRadius: 20,
        background: `${config.bg}22`,
        border: `2px solid ${config.bg}`,
        transform: `scale(${scale * p})`,
        boxShadow: `0 0 15px ${config.glow}44`,
      }}
    >
      <span
        style={{
          color: config.bg,
          fontSize: 16,
          fontWeight: "bold",
          fontFamily: "Inter, sans-serif",
          letterSpacing: 1,
        }}
      >
        {config.label}
      </span>
    </div>
  );
};
