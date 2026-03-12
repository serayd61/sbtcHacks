import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BTC_ORANGE, GOLD } from "../lib/colors";
import { BOUNCY } from "../lib/springs";

export const CoinAnimation: React.FC<{
  startFrame?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  duration?: number;
  label?: string;
  size?: number;
}> = ({
  startFrame = 0,
  fromX = 0,
  fromY = 0,
  toX = 300,
  toY = 0,
  duration = 60,
  label,
  size = 60,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = Math.max(0, frame - startFrame);

  if (f < 0 || f > duration + 30) return null;

  const progress = interpolate(f, [0, duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const x = interpolate(progress, [0, 1], [fromX, toX]);
  const y =
    interpolate(progress, [0, 1], [fromY, toY]) -
    Math.sin(progress * Math.PI) * 80;

  const rotation = interpolate(f, [0, duration], [0, 720], {
    extrapolateRight: "clamp",
  });

  const scale = spring({
    fps,
    frame: f,
    config: BOUNCY,
  });

  const opacity = interpolate(f, [0, 5, duration - 5, duration + 30], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        opacity,
        transform: `scale(${Math.min(scale, 1)}) rotateY(${rotation}deg)`,
        transformStyle: "preserve-3d",
        perspective: 800,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${GOLD}, ${BTC_ORANGE})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 4px 15px ${BTC_ORANGE}66`,
          border: "2px solid rgba(255,255,255,0.3)",
        }}
      >
        <span
          style={{
            fontSize: size * 0.45,
            fontWeight: "bold",
            color: "white",
            fontFamily: "Inter, sans-serif",
          }}
        >
          ₿
        </span>
      </div>
      {label && (
        <div
          style={{
            textAlign: "center",
            color: "white",
            fontSize: 14,
            fontFamily: "Inter, sans-serif",
            marginTop: 4,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};
