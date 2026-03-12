import { AbsoluteFill, Sequence, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { PriceChart } from "../components/PriceChart";
import { PayoutFormula } from "../components/PayoutFormula";
import {
  BG_BLACK,
  TEXT_PRIMARY,
  GOLD,
  GREEN_ITM,
  BTC_ORANGE,
  TEXT_SECONDARY,
} from "../lib/colors";
import { fadeIn, scaleIn, pulse } from "../lib/animations";
import { OVERSHOOT } from "../lib/springs";

export const Scene6HowYouWin: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Rocket animation
  const rocketY = interpolate(frame, [90, 180], [300, 50], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rocketOpacity = fadeIn(frame, 90, 10);

  // 900% ROI big reveal
  const roiFrame = Math.max(0, frame - 650);
  const roiScale = spring({ fps, frame: roiFrame, config: OVERSHOOT });
  const roiPulse = pulse(frame, 0.03, 0.05);

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
            color: GREEN_ITM,
            fontFamily: "Inter, sans-serif",
          }}
        >
          How You Win
        </div>
      </div>

      {/* Left: Price chart with rocket */}
      <Sequence from={20} durationInFrames={300}>
        <div style={{ position: "absolute", left: 60, top: 100 }}>
          <PriceChart
            startFrame={0}
            drawDuration={120}
            strikePrice={90000}
            dataPoints={[84000, 85000, 87000, 89000, 91000, 94000, 97000, 100000]}
            width={550}
            height={350}
            showStrikeLine
            showITMZone
          />

          {/* Rocket */}
          <div
            style={{
              position: "absolute",
              right: 80,
              top: rocketY,
              fontSize: 40,
              opacity: rocketOpacity,
              transform: "rotate(-45deg)",
              filter: `drop-shadow(0 0 10px ${BTC_ORANGE})`,
            }}
          >
            🚀
          </div>
        </div>
      </Sequence>

      {/* Right: Payout formula */}
      <div style={{ position: "absolute", left: 680, top: 80, transform: "scale(0.7)", transformOrigin: "top left" }}>
        <Sequence from={180}>
          <PayoutFormula startFrame={0} />
        </Sequence>
      </div>

      {/* Big 900% ROI overlay */}
      {frame > 650 && (
        <div
          style={{
            position: "absolute",
            bottom: 40,
            left: "50%",
            transform: `translateX(-50%) scale(${roiScale * roiPulse})`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: "bold",
              fontFamily: "Inter, sans-serif",
              background: `linear-gradient(135deg, ${GOLD}, ${BTC_ORANGE})`,
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              textShadow: `0 0 40px ${GOLD}44`,
              filter: `drop-shadow(0 0 20px ${GOLD}66)`,
            }}
          >
            900% ROI
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
