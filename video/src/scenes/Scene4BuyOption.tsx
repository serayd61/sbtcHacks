import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { NavBar } from "../components/NavBar";
import { OptionCard } from "../components/OptionCard";
import { CoinPipeline } from "../components/CoinPipeline";
import { ConfettiEffect } from "../components/ConfettiEffect";
import {
  BG_BLACK,
  GREEN_ITM,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  BG_CARD,
  BORDER_CARD,
  BTC_ORANGE,
} from "../lib/colors";
import { fadeIn, slideUp } from "../lib/animations";

export const Scene4BuyOption: React.FC = () => {
  const frame = useCurrentFrame();

  // Success message
  const successOpacity = fadeIn(frame, 500, 15);
  const successSlide = slideUp(frame, 500, 40);

  return (
    <AbsoluteFill style={{ backgroundColor: BG_BLACK }}>
      {/* Phase 1: Browser with market page (0-350) */}
      <Sequence from={0} durationInFrames={380}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <BrowserFrame startFrame={0} url="sbtc-vault.app/market" width={1200} height={700}>
            <NavBar startFrame={10} activeTab="Market" />

            {/* Market title */}
            <div
              style={{
                padding: "20px 30px 10px",
                opacity: fadeIn(frame, 30, 15),
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: "bold",
                  color: TEXT_PRIMARY,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Options Market
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: TEXT_SECONDARY,
                  fontFamily: "Inter, sans-serif",
                  marginTop: 4,
                }}
              >
                Browse and buy covered call options
              </div>
            </div>

            {/* Option cards */}
            <div
              style={{
                display: "flex",
                gap: 20,
                padding: "10px 30px",
                justifyContent: "center",
              }}
            >
              <OptionCard
                startFrame={50}
                optionId={12}
                strikePrice="$90,000"
                premium="0.05 sBTC"
                collateral="5 sBTC"
                highlighted
              />
              <OptionCard
                startFrame={80}
                optionId={13}
                strikePrice="$95,000"
                premium="0.02 sBTC"
                collateral="3 sBTC"
              />
              <OptionCard
                startFrame={110}
                optionId={14}
                strikePrice="$85,000"
                premium="0.08 sBTC"
                collateral="4 sBTC"
              />
            </div>
          </BrowserFrame>
        </AbsoluteFill>
      </Sequence>

      {/* Phase 2: Coin pipeline animation (350-550) */}
      <Sequence from={350} durationInFrames={250}>
        <AbsoluteFill
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 40,
          }}
        >
          {/* Transaction label */}
          <div
            style={{
              color: TEXT_SECONDARY,
              fontSize: 18,
              fontFamily: "Inter, sans-serif",
              letterSpacing: 2,
              textTransform: "uppercase",
              opacity: fadeIn(frame - 350, 0, 15),
            }}
          >
            Processing Transaction
          </div>

          <CoinPipeline
            startFrame={10}
            duration={100}
            fromLabel="Your Wallet"
            toLabel="Options Vault"
            pipelineLabel="Stacks Blockchain"
            width={900}
          />

          {/* Success ticket */}
          <div
            style={{
              padding: "16px 32px",
              borderRadius: 12,
              background: `${GREEN_ITM}15`,
              border: `1px solid ${GREEN_ITM}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
              opacity: successOpacity,
              transform: `translateY(${successSlide}px)`,
            }}
          >
            <span style={{ fontSize: 24, color: GREEN_ITM }}>✓</span>
            <span
              style={{
                color: TEXT_PRIMARY,
                fontSize: 20,
                fontWeight: "bold",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Option Position Created
            </span>
          </div>
        </AbsoluteFill>

        {/* Confetti on success */}
        <ConfettiEffect startFrame={150} count={30} originX={960} originY={400} />
      </Sequence>

      {/* Phase 3: Position card (550+) */}
      <Sequence from={580} durationInFrames={170}>
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              padding: 32,
              borderRadius: 16,
              background: BG_CARD,
              border: `1px solid ${BTC_ORANGE}44`,
              opacity: fadeIn(frame - 580, 0, 15),
              transform: `translateX(${slideUp(frame - 580, 0, 40)}px)`,
              boxShadow: `0 0 40px ${BTC_ORANGE}15`,
              minWidth: 400,
            }}
          >
            <div
              style={{
                color: TEXT_SECONDARY,
                fontSize: 14,
                fontFamily: "Inter, sans-serif",
                marginBottom: 8,
                letterSpacing: 1,
              }}
            >
              YOUR POSITION
            </div>
            <div
              style={{
                color: TEXT_PRIMARY,
                fontSize: 24,
                fontWeight: "bold",
                fontFamily: "Inter, sans-serif",
                marginBottom: 16,
              }}
            >
              CALL Option #12
            </div>
            {[
              { l: "Strike", v: "$90,000" },
              { l: "Premium Paid", v: "0.05 sBTC" },
              { l: "Collateral", v: "5 sBTC" },
              { l: "Status", v: "Active", color: GREEN_ITM },
            ].map(({ l, v, color }) => (
              <div
                key={l}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <span style={{ color: TEXT_SECONDARY, fontSize: 16 }}>{l}</span>
                <span
                  style={{
                    color: color || TEXT_PRIMARY,
                    fontSize: 16,
                    fontWeight: 600,
                  }}
                >
                  {v}
                </span>
              </div>
            ))}
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
