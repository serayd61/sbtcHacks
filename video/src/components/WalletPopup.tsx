import { spring, useCurrentFrame, useVideoConfig, interpolate } from "remotion";
import { BG_CARD, BORDER_CARD, TEXT_PRIMARY, TEXT_SECONDARY, GREEN_ITM, BTC_ORANGE } from "../lib/colors";
import { SNAPPY } from "../lib/springs";
import { fadeIn } from "../lib/animations";

export const WalletPopup: React.FC<{
  startFrame?: number;
  showConnected?: boolean;
  connectedFrame?: number;
}> = ({ startFrame = 0, showConnected = true, connectedFrame = 40 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  const slideIn = spring({ fps, frame: f, config: SNAPPY });
  const x = interpolate(slideIn, [0, 1], [300, 0]);
  const opacity = fadeIn(frame, startFrame, 10);

  const isConnected = f > connectedFrame;
  const checkScale = isConnected
    ? spring({ fps, frame: Math.max(0, f - connectedFrame), config: SNAPPY })
    : 0;

  return (
    <div
      style={{
        width: 280,
        padding: 24,
        borderRadius: 16,
        background: BG_CARD,
        border: `1px solid ${BORDER_CARD}`,
        opacity,
        transform: `translateX(${x}px)`,
        boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
      }}
    >
      <div
        style={{
          color: TEXT_PRIMARY,
          fontSize: 18,
          fontWeight: "bold",
          fontFamily: "Inter, sans-serif",
          marginBottom: 20,
          textAlign: "center",
        }}
      >
        Connect Wallet
      </div>

      {["Leather", "Xverse"].map((wallet, i) => (
        <div
          key={wallet}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 16px",
            borderRadius: 10,
            background: i === 0 && isConnected ? `${GREEN_ITM}15` : "rgba(255,255,255,0.05)",
            border: `1px solid ${i === 0 && isConnected ? GREEN_ITM : BORDER_CARD}`,
            marginBottom: 10,
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              background: i === 0 ? BTC_ORANGE : "#6366f1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            {i === 0 ? "L" : "X"}
          </div>
          <span
            style={{
              color: TEXT_PRIMARY,
              fontSize: 16,
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              flex: 1,
            }}
          >
            {wallet}
          </span>
          {i === 0 && isConnected && (
            <div
              style={{
                transform: `scale(${checkScale})`,
                color: GREEN_ITM,
                fontSize: 20,
                fontWeight: "bold",
              }}
            >
              ✓
            </div>
          )}
        </div>
      ))}

      {isConnected && (
        <div
          style={{
            marginTop: 12,
            padding: "8px 12px",
            borderRadius: 8,
            background: `${GREEN_ITM}15`,
            border: `1px solid ${GREEN_ITM}44`,
            textAlign: "center",
            opacity: fadeIn(frame, startFrame + connectedFrame + 10, 10),
          }}
        >
          <span
            style={{
              color: GREEN_ITM,
              fontSize: 13,
              fontFamily: "Inter, sans-serif",
            }}
          >
            Connected: SP38...4C5W
          </span>
        </div>
      )}
    </div>
  );
};
