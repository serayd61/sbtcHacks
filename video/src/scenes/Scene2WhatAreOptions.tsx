import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { CharacterIcon } from "../components/CharacterIcon";
import { ContractDocument } from "../components/ContractDocument";
import { CoinAnimation } from "../components/CoinAnimation";
import { BG_BLACK, TEXT_PRIMARY, TEXT_SECONDARY, GREEN_ITM, RED_LOSS, GOLD, BTC_ORANGE } from "../lib/colors";
import { fadeIn, slideUp, typewriter } from "../lib/animations";

export const Scene2WhatAreOptions: React.FC = () => {
  const frame = useCurrentFrame();

  // Scale text
  const riskRewardOpacity = fadeIn(frame, 380, 20);
  const riskSlide = slideUp(frame, 380, 30);

  return (
    <AbsoluteFill style={{ backgroundColor: BG_BLACK }}>
      {/* Two characters */}
      <div
        style={{
          position: "absolute",
          left: 200,
          top: 280,
        }}
      >
        <CharacterIcon type="depositor" startFrame={10} fromDirection="left" />
      </div>

      <div
        style={{
          position: "absolute",
          right: 200,
          top: 280,
        }}
      >
        <CharacterIcon type="buyer" startFrame={20} fromDirection="right" />
      </div>

      {/* Contract document in the middle */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: 240,
          transform: "translateX(-50%)",
        }}
      >
        <Sequence from={60}>
          <ContractDocument startFrame={0} />
        </Sequence>
      </div>

      {/* Coin flowing from buyer to vault */}
      <Sequence from={250} durationInFrames={120}>
        <CoinAnimation
          startFrame={0}
          fromX={1400}
          fromY={350}
          toX={500}
          toY={350}
          duration={80}
          label="0.05 sBTC"
          size={50}
        />
      </Sequence>

      {/* Risk / Reward display */}
      <div
        style={{
          position: "absolute",
          bottom: 100,
          left: "50%",
          transform: `translateX(-50%) translateY(${riskSlide}px)`,
          opacity: riskRewardOpacity,
          display: "flex",
          gap: 80,
        }}
      >
        {/* Risk side */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: `${RED_LOSS}22`,
              border: `2px solid ${RED_LOSS}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 10px",
              fontSize: 28,
            }}
          >
            ⬇️
          </div>
          <div
            style={{
              color: TEXT_SECONDARY,
              fontSize: 14,
              fontFamily: "Inter, sans-serif",
              marginBottom: 4,
            }}
          >
            Risk
          </div>
          <div
            style={{
              color: TEXT_PRIMARY,
              fontSize: 18,
              fontWeight: "bold",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Only Premium Paid
          </div>
        </div>

        {/* VS */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: TEXT_SECONDARY,
            fontSize: 20,
            fontFamily: "Inter, sans-serif",
          }}
        >
          vs
        </div>

        {/* Reward side */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: `${GREEN_ITM}22`,
              border: `2px solid ${GREEN_ITM}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 10px",
              fontSize: 28,
            }}
          >
            🚀
          </div>
          <div
            style={{
              color: TEXT_SECONDARY,
              fontSize: 14,
              fontFamily: "Inter, sans-serif",
              marginBottom: 4,
            }}
          >
            Reward
          </div>
          <div
            style={{
              color: TEXT_PRIMARY,
              fontSize: 18,
              fontWeight: "bold",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Massive Upside
          </div>
        </div>
      </div>

      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 60,
          left: "50%",
          transform: "translateX(-50%)",
          opacity: fadeIn(frame, 5, 15),
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: "bold",
            color: GOLD,
            fontFamily: "Inter, sans-serif",
            textAlign: "center",
          }}
        >
          How Options Work
        </div>
      </div>
    </AbsoluteFill>
  );
};
