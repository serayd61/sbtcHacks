import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { PriceChart } from "../components/PriceChart";
import { StatusBadge } from "../components/StatusBadge";
import {
  BG_BLACK,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  GREEN_ITM,
  ORANGE_OTM,
  BG_CARD,
  BORDER_CARD,
  GOLD,
} from "../lib/colors";
import { fadeIn, slideUp, countUp } from "../lib/animations";

export const Scene5TrackPosition: React.FC = () => {
  const frame = useCurrentFrame();

  // ITM scenario data
  const itmData = [85000, 86000, 87500, 89000, 88500, 90500, 92000, 93500, 95000];
  // OTM scenario data
  const otmData = [89000, 88000, 87000, 86500, 85000, 84500, 85500, 86000, 85000];

  const showingOTM = frame > 280;

  return (
    <AbsoluteFill style={{ backgroundColor: BG_BLACK }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 50,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: fadeIn(frame, 5, 15),
        }}
      >
        <div
          style={{
            fontSize: 32,
            fontWeight: "bold",
            color: GOLD,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Track Your Position
        </div>
      </div>

      {/* ITM Scenario */}
      <Sequence from={20} durationInFrames={280}>
        <AbsoluteFill>
          <div
            style={{
              position: "absolute",
              left: 160,
              top: 130,
            }}
          >
            <PriceChart
              startFrame={0}
              drawDuration={120}
              strikePrice={90000}
              dataPoints={itmData}
              width={800}
              height={400}
              showStrikeLine
              showITMZone
            />
          </div>

          {/* Status + P&L */}
          <div
            style={{
              position: "absolute",
              right: 160,
              top: 180,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            }}
          >
            <Sequence from={140}>
              <StatusBadge status="itm" startFrame={0} />
            </Sequence>

            <div
              style={{
                padding: 20,
                borderRadius: 12,
                background: BG_CARD,
                border: `1px solid ${GREEN_ITM}44`,
                textAlign: "center",
                opacity: fadeIn(frame - 20, 160, 15),
              }}
            >
              <div
                style={{
                  color: TEXT_SECONDARY,
                  fontSize: 14,
                  fontFamily: "Inter, sans-serif",
                  marginBottom: 4,
                }}
              >
                Unrealized P&L
              </div>
              <div
                style={{
                  color: GREEN_ITM,
                  fontSize: 28,
                  fontWeight: "bold",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                +0.20 sBTC
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* OTM Scenario */}
      <Sequence from={280} durationInFrames={170}>
        <AbsoluteFill>
          <div style={{ position: "absolute", left: 160, top: 130 }}>
            <PriceChart
              startFrame={0}
              drawDuration={80}
              strikePrice={90000}
              dataPoints={otmData}
              width={800}
              height={400}
              showStrikeLine
              showITMZone
            />
          </div>

          <div
            style={{
              position: "absolute",
              right: 160,
              top: 180,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 20,
            }}
          >
            <Sequence from={100}>
              <StatusBadge status="otm" startFrame={0} />
            </Sequence>

            <div
              style={{
                padding: 20,
                borderRadius: 12,
                background: BG_CARD,
                border: `1px solid ${ORANGE_OTM}44`,
                textAlign: "center",
                opacity: fadeIn(frame - 280, 120, 15),
              }}
            >
              <div
                style={{
                  color: TEXT_SECONDARY,
                  fontSize: 14,
                  fontFamily: "Inter, sans-serif",
                  marginBottom: 4,
                }}
              >
                Max Loss
              </div>
              <div
                style={{
                  color: ORANGE_OTM,
                  fontSize: 28,
                  fontWeight: "bold",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                -0.05 sBTC
              </div>
              <div
                style={{
                  color: TEXT_SECONDARY,
                  fontSize: 12,
                  fontFamily: "Inter, sans-serif",
                  marginTop: 4,
                }}
              >
                Premium Only
              </div>
            </div>
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
