import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { BitcoinLogo } from "../components/BitcoinLogo";
import { VaultLogo } from "../components/VaultLogo";
import { ConfettiEffect } from "../components/ConfettiEffect";
import {
  BTC_ORANGE,
  GOLD,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
  BG_BLACK,
  RED_LOSS,
  GREEN_ITM,
} from "../lib/colors";
import { fadeIn, slideUp, typewriter, pulse } from "../lib/animations";

export const Scene1Intro: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase 1: Radial glow background
  const glowSize = interpolate(frame, [0, 60], [0, 600], {
    extrapolateRight: "clamp",
  });

  // Phase 2: Fork paths
  const forkProgress = interpolate(frame, [90, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const leftX = interpolate(forkProgress, [0, 1], [960, 400]);
  const rightX = interpolate(forkProgress, [0, 1], [960, 1520]);

  // Phase 3: Zoom to vault
  const zoomScale = interpolate(frame, [150, 210], [1, 1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const zoomX = interpolate(frame, [150, 210], [0, -560 * 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Phase 4: Title reveal
  const titleOpacity = fadeIn(frame, 200, 20);
  const titleText = typewriter(frame, 210, "sBTC Options Vault", 1.2);

  // Phase 5: Tagline
  const taglineOpacity = fadeIn(frame, 260, 20);
  const tagSlide = slideUp(frame, 260, 30);

  // Phase 6: Stacks bridge
  const bridgeProgress = interpolate(frame, [300, 340], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BG_BLACK, overflow: "hidden" }}>
      {/* Radial glow */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: glowSize,
          height: glowSize,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BTC_ORANGE}15, transparent)`,
          transform: "translate(-50%, -50%)",
        }}
      />

      {/* Fork container - pre-zoom */}
      {frame < 200 && (
        <div
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            transform: `scale(${frame > 150 ? zoomScale : 1}) translateX(${frame > 150 ? zoomX : 0}px)`,
            transformOrigin: "center center",
          }}
        >
          {/* Bitcoin logo center (before fork) */}
          {frame < 90 && (
            <div style={{ position: "absolute", left: 860, top: 340 }}>
              <BitcoinLogo size={200} startFrame={20} />
            </div>
          )}

          {/* Left fork - idle coins */}
          {forkProgress > 0 && (
            <div
              style={{
                position: "absolute",
                left: leftX - 100,
                top: 380,
                textAlign: "center",
                opacity: forkProgress,
              }}
            >
              <div style={{ fontSize: 60, marginBottom: 8 }}>💤</div>
              <div
                style={{
                  color: RED_LOSS,
                  fontSize: 24,
                  fontWeight: "bold",
                  fontFamily: "Inter, sans-serif",
                  opacity: fadeIn(frame, 130, 20),
                }}
              >
                0% Yield
              </div>
            </div>
          )}

          {/* Right fork - growing vault */}
          {forkProgress > 0 && (
            <div
              style={{
                position: "absolute",
                left: rightX - 100,
                top: 360,
                textAlign: "center",
                opacity: forkProgress,
              }}
            >
              <div style={{ fontSize: 60, marginBottom: 8 }}>🏦</div>
              <div
                style={{
                  color: GREEN_ITM,
                  fontSize: 24,
                  fontWeight: "bold",
                  fontFamily: "Inter, sans-serif",
                  opacity: fadeIn(frame, 130, 20),
                }}
              >
                +{interpolate(frame, [120, 180], [0, 4.8], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }).toFixed(1)}
                % Yield
              </div>
            </div>
          )}
        </div>
      )}

      {/* Title + Vault logo after zoom */}
      {frame >= 200 && (
        <div
          style={{
            position: "absolute",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            top: 200,
          }}
        >
          <Sequence from={0}>
            <VaultLogo size={180} startFrame={0} />
          </Sequence>

          <div
            style={{
              marginTop: 30,
              opacity: titleOpacity,
            }}
          >
            <div
              style={{
                fontSize: 64,
                fontWeight: "bold",
                fontFamily: "Inter, sans-serif",
                background: `linear-gradient(135deg, ${GOLD}, ${BTC_ORANGE})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textAlign: "center",
              }}
            >
              {titleText}
              {titleText.length < 18 && (
                <span
                  style={{
                    WebkitTextFillColor: GOLD,
                    opacity: Math.sin(frame * 0.3) > 0 ? 1 : 0,
                  }}
                >
                  |
                </span>
              )}
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              opacity: taglineOpacity,
              transform: `translateY(${tagSlide}px)`,
            }}
          >
            <div
              style={{
                fontSize: 24,
                color: TEXT_SECONDARY,
                fontFamily: "Inter, sans-serif",
                textAlign: "center",
                letterSpacing: 1,
              }}
            >
              The First Covered Call Options Platform on Bitcoin
            </div>
          </div>

          {/* Stacks bridge */}
          <div
            style={{
              marginTop: 40,
              display: "flex",
              alignItems: "center",
              gap: 20,
              opacity: fadeIn(frame, 300, 15),
            }}
          >
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                background: `linear-gradient(135deg, ${GOLD}, ${BTC_ORANGE})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                fontWeight: "bold",
                color: "white",
              }}
            >
              ₿
            </div>
            <svg width={120} height={4}>
              <rect
                width={120 * bridgeProgress}
                height={4}
                rx={2}
                fill={BTC_ORANGE}
              />
            </svg>
            <div
              style={{
                width: 50,
                height: 50,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #5546FF, #7B61FF)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: "bold",
                color: "white",
                fontFamily: "Inter, sans-serif",
              }}
            >
              STX
            </div>
          </div>

          {/* Confetti */}
          <ConfettiEffect startFrame={210} count={30} originX={960} originY={300} />
        </div>
      )}
    </AbsoluteFill>
  );
};
