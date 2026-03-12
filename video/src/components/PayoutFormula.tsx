import { useCurrentFrame } from "remotion";
import { typewriter, fadeIn } from "../lib/animations";
import {
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  GREEN_ITM,
  RED_LOSS,
  GOLD,
  BG_CARD,
  BORDER_CARD,
} from "../lib/colors";

interface FormulaLine {
  text: string;
  color?: string;
  bold?: boolean;
  size?: number;
  delay: number; // frames after startFrame
}

export const PayoutFormula: React.FC<{
  startFrame?: number;
}> = ({ startFrame = 0 }) => {
  const frame = useCurrentFrame();

  const lines: FormulaLine[] = [
    { text: "SETTLEMENT: $100,000 ✓", color: GREEN_ITM, bold: true, size: 24, delay: 0 },
    { text: "STRIKE:           $90,000", color: TEXT_SECONDARY, size: 24, delay: 25 },
    { text: "────────────────────", color: BORDER_CARD, size: 20, delay: 50 },
    { text: "DIFFERENCE:    $10,000", color: TEXT_PRIMARY, bold: true, size: 24, delay: 65 },
    { text: "", color: TEXT_PRIMARY, size: 12, delay: 85 },
    { text: "PAYOUT FORMULA:", color: GOLD, bold: true, size: 20, delay: 95 },
    { text: "= Collateral × (Settlement - Strike) / Settlement", color: TEXT_SECONDARY, size: 20, delay: 115 },
    { text: "= 5 sBTC × ($10,000 / $100,000)", color: TEXT_SECONDARY, size: 20, delay: 145 },
    { text: "= 5 sBTC × 0.10", color: TEXT_SECONDARY, size: 20, delay: 170 },
    { text: "= 0.50 sBTC", color: GOLD, bold: true, size: 28, delay: 195 },
    { text: "", color: TEXT_PRIMARY, size: 12, delay: 215 },
    { text: "PREMIUM PAID:    −0.05 sBTC", color: RED_LOSS, size: 22, delay: 225 },
    { text: "PAYOUT:          +0.50 sBTC", color: GREEN_ITM, size: 22, delay: 250 },
    { text: "────────────────────", color: BORDER_CARD, size: 20, delay: 270 },
    { text: "NET PROFIT:      +0.45 sBTC", color: GOLD, bold: true, size: 26, delay: 285 },
    { text: "ROI:              900%", color: GOLD, bold: true, size: 32, delay: 310 },
  ];

  return (
    <div
      style={{
        padding: 32,
        background: BG_CARD,
        borderRadius: 16,
        border: `1px solid ${BORDER_CARD}`,
        minWidth: 500,
      }}
    >
      {lines.map((line, i) => {
        const lineStart = startFrame + line.delay;
        const opacity = fadeIn(frame, lineStart, 10);
        const text = typewriter(frame, lineStart, line.text, 2);

        if (!line.text) return <div key={i} style={{ height: 8 }} />;

        return (
          <div
            key={i}
            style={{
              color: line.color || TEXT_PRIMARY,
              fontSize: line.size || 20,
              fontWeight: line.bold ? "bold" : "normal",
              fontFamily: "'Courier New', monospace",
              opacity,
              marginBottom: 6,
              whiteSpace: "pre",
              textShadow:
                line.color === GOLD ? `0 0 20px ${GOLD}44` : undefined,
            }}
          >
            {text}
            {text.length < line.text.length && (
              <span
                style={{
                  opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                  color: GOLD,
                }}
              >
                ▋
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};
