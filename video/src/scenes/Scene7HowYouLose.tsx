import { AbsoluteFill, Sequence, useCurrentFrame, spring, useVideoConfig } from "remotion";
import { PriceChart } from "../components/PriceChart";
import { ShieldIcon } from "../components/ShieldIcon";
import { StatusBadge } from "../components/StatusBadge";
import {
  BG_BLACK,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  RED_LOSS,
  GREEN_ITM,
  ORANGE_OTM,
  GOLD,
  BG_CARD,
  BORDER_CARD,
} from "../lib/colors";
import { fadeIn, slideUp } from "../lib/animations";
import { SNAPPY } from "../lib/springs";

export const Scene7HowYouLose: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: BG_BLACK }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 30,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: fadeIn(frame, 5, 15),
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: "bold",
            color: ORANGE_OTM,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Defined Risk
        </div>
      </div>

      {/* Chart showing price below strike */}
      <div style={{ position: "absolute", left: 100, top: 100 }}>
        <Sequence from={20}>
          <PriceChart
            startFrame={0}
            drawDuration={80}
            strikePrice={90000}
            dataPoints={[87000, 86000, 85500, 84000, 85000, 84500, 83000, 84000, 85000]}
            width={550}
            height={320}
            showStrikeLine
          />
        </Sequence>
      </div>

      {/* Expired badge */}
      <div style={{ position: "absolute", left: 300, top: 430 }}>
        <Sequence from={120}>
          <StatusBadge status="expired" startFrame={0} />
        </Sequence>
      </div>

      {/* Shield with defined risk */}
      <div style={{ position: "absolute", right: 250, top: 140 }}>
        <Sequence from={180}>
          <ShieldIcon
            startFrame={0}
            text="MAX LOSS = 0.05 sBTC"
            color={GREEN_ITM}
          />
        </Sequence>
      </div>

      {/* Comparison: Leverage vs Options */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 60,
          opacity: fadeIn(frame, 280, 20),
        }}
      >
        {/* Leverage */}
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            background: BG_CARD,
            border: `1px solid ${RED_LOSS}44`,
            textAlign: "center",
            width: 280,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>❌</div>
          <div
            style={{
              color: RED_LOSS,
              fontSize: 20,
              fontWeight: "bold",
              fontFamily: "Inter, sans-serif",
              marginBottom: 8,
            }}
          >
            Leveraged Trading
          </div>
          <div
            style={{
              color: TEXT_SECONDARY,
              fontSize: 14,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Risk of total liquidation
          </div>
          <div
            style={{
              marginTop: 12,
              padding: "6px 14px",
              borderRadius: 6,
              background: `${RED_LOSS}22`,
              color: RED_LOSS,
              fontSize: 14,
              fontWeight: "bold",
              fontFamily: "Inter, sans-serif",
              display: "inline-block",
            }}
          >
            LIQUIDATED
          </div>
        </div>

        {/* Options */}
        <div
          style={{
            padding: 24,
            borderRadius: 12,
            background: BG_CARD,
            border: `1px solid ${GREEN_ITM}44`,
            textAlign: "center",
            width: 280,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
          <div
            style={{
              color: GREEN_ITM,
              fontSize: 20,
              fontWeight: "bold",
              fontFamily: "Inter, sans-serif",
              marginBottom: 8,
            }}
          >
            Options Trading
          </div>
          <div
            style={{
              color: TEXT_SECONDARY,
              fontSize: 14,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Lose only the premium paid
          </div>
          <div
            style={{
              marginTop: 12,
              padding: "6px 14px",
              borderRadius: 6,
              background: `${GREEN_ITM}22`,
              color: GREEN_ITM,
              fontSize: 14,
              fontWeight: "bold",
              fontFamily: "Inter, sans-serif",
              display: "inline-block",
            }}
          >
            PORTFOLIO SAFE
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
