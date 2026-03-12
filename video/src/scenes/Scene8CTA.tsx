import { AbsoluteFill, Sequence, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { VaultLogo } from "../components/VaultLogo";
import { CoinPipeline } from "../components/CoinPipeline";
import {
  BG_BLACK,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  GOLD,
  BTC_ORANGE,
  ACCENT_ORANGE,
  GREEN_ITM,
} from "../lib/colors";
import { fadeIn, slideUp, typewriter, pulse } from "../lib/animations";
import { SNAPPY, SMOOTH } from "../lib/springs";

export const Scene8CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Claim button press
  const buttonPress =
    frame > 10 && frame < 30
      ? interpolate(frame, [10, 18, 30], [1, 0.95, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      : 1;

  // Features
  const features = [
    { icon: "🔒", label: "Fully On-Chain", delay: 240 },
    { icon: "📊", label: "Transparent Pricing", delay: 270 },
    { icon: "⚡", label: "Powered by Stacks", delay: 300 },
  ];

  const ctaPulse = pulse(frame, 0.04, 0.03);

  return (
    <AbsoluteFill style={{ backgroundColor: BG_BLACK }}>
      {/* Claim payout flow */}
      <Sequence from={0} durationInFrames={120}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 30,
          }}
        >
          {/* Claim button */}
          <div
            style={{
              padding: "16px 40px",
              borderRadius: 12,
              background: `linear-gradient(135deg, ${GREEN_ITM}, #16a34a)`,
              color: "white",
              fontSize: 22,
              fontWeight: "bold",
              fontFamily: "Inter, sans-serif",
              transform: `scale(${buttonPress})`,
              boxShadow: `0 0 30px ${GREEN_ITM}44`,
              opacity: fadeIn(frame, 0, 10),
            }}
          >
            Claim Payout ✓
          </div>

          {/* Coin pipeline reverse */}
          <Sequence from={30}>
            <CoinPipeline
              startFrame={0}
              duration={70}
              fromLabel="Vault"
              toLabel="Your Wallet"
              pipelineLabel="Payout Transfer"
              width={700}
            />
          </Sequence>
        </AbsoluteFill>
      </Sequence>

      {/* Logo + tagline reveal */}
      <Sequence from={140} durationInFrames={280}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <VaultLogo size={160} startFrame={0} />

          {/* Tagline */}
          <div
            style={{
              marginTop: 20,
              opacity: fadeIn(frame - 140, 60, 20),
            }}
          >
            <div
              style={{
                fontSize: 40,
                fontWeight: "bold",
                fontFamily: "Inter, sans-serif",
                background: `linear-gradient(135deg, ${GOLD}, ${BTC_ORANGE})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textAlign: "center",
              }}
            >
              {typewriter(frame - 140, 60, "Structured Yield on Bitcoin", 1)}
            </div>
          </div>

          {/* 3 Feature icons */}
          <div
            style={{
              display: "flex",
              gap: 50,
              marginTop: 30,
            }}
          >
            {features.map(({ icon, label, delay }) => {
              const featureScale = spring({
                fps,
                frame: Math.max(0, frame - 140 - delay),
                config: SNAPPY,
              });
              return (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    transform: `scale(${featureScale})`,
                  }}
                >
                  <div
                    style={{
                      width: 60,
                      height: 60,
                      borderRadius: "50%",
                      background: `${BTC_ORANGE}15`,
                      border: `2px solid ${BTC_ORANGE}44`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 28,
                    }}
                  >
                    {icon}
                  </div>
                  <span
                    style={{
                      color: TEXT_SECONDARY,
                      fontSize: 15,
                      fontFamily: "Inter, sans-serif",
                      fontWeight: 500,
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* CTA Button */}
          <div
            style={{
              marginTop: 40,
              padding: "14px 40px",
              borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT_ORANGE}, ${BTC_ORANGE})`,
              color: "white",
              fontSize: 20,
              fontWeight: "bold",
              fontFamily: "Inter, sans-serif",
              transform: `scale(${ctaPulse})`,
              boxShadow: `0 0 30px ${BTC_ORANGE}33`,
              opacity: fadeIn(frame - 140, 320, 15),
            }}
          >
            Start Trading Now →
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
