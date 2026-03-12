import { useCurrentFrame } from "remotion";
import {
  BG_CARD,
  BORDER_CARD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  BTC_ORANGE,
  GREEN_ITM,
  GOLD,
} from "../lib/colors";
import { fadeIn, countUp, slideUp } from "../lib/animations";

export const DashboardMock: React.FC<{
  startFrame?: number;
}> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();

  const stats = [
    {
      label: "Total Value Locked",
      value: `${(countUp(frame, startFrame + 30, 125, 45) / 10).toFixed(1)} sBTC`,
      color: BTC_ORANGE,
      delay: 0,
      icon: "🔒",
    },
    {
      label: "Share Price",
      value: `${(countUp(frame, startFrame + 60, 1045, 45) / 1000).toFixed(3)} sBTC`,
      color: GREEN_ITM,
      delay: 30,
      icon: "📈",
    },
    {
      label: "Active Epoch",
      value: `Epoch #${countUp(frame, startFrame + 90, 7, 30)}`,
      color: GOLD,
      delay: 60,
      icon: "⚡",
    },
  ];

  return (
    <div style={{ display: "flex", gap: 20, padding: 20 }}>
      {stats.map(({ label, value, color, delay, icon }) => {
        const cardOpacity = fadeIn(frame, startFrame + delay, 15);
        const cardSlide = slideUp(frame, startFrame + delay, 30);

        return (
          <div
            key={label}
            style={{
              flex: 1,
              padding: 20,
              borderRadius: 12,
              background: BG_CARD,
              border: `1px solid ${BORDER_CARD}`,
              opacity: cardOpacity,
              transform: `translateY(${cardSlide}px)`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 18 }}>{icon}</span>
              <span
                style={{
                  color: TEXT_SECONDARY,
                  fontSize: 13,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                {label}
              </span>
            </div>
            <div
              style={{
                color: color,
                fontSize: 24,
                fontWeight: "bold",
                fontFamily: "Inter, sans-serif",
              }}
            >
              {value}
            </div>
          </div>
        );
      })}
    </div>
  );
};
