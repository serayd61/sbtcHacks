import { useCurrentFrame } from "remotion";
import { BTC_ORANGE, GOLD } from "../lib/colors";
import { particleBurst } from "../lib/animations";

const COLORS = [BTC_ORANGE, GOLD, "#ffffff", "#f59e0b", "#fbbf24", "#ea580c"];

export const ConfettiEffect: React.FC<{
  startFrame?: number;
  count?: number;
  originX?: number;
  originY?: number;
}> = ({ startFrame = 0, count = 25, originX = 0, originY = 0 }) => {
  const frame = useCurrentFrame();
  const particles = particleBurst(frame, startFrame, count, {
    spread: 400,
    gravity: 0.5,
    lifetime: 50,
  });

  if (particles.length === 0) return null;

  return (
    <>
      {particles.map((p, i) => {
        const color = COLORS[i % COLORS.length];
        const size = 6 + (i % 4) * 3;
        const rotation = (frame - startFrame) * (5 + i) * 3;
        const isSquare = i % 3 === 0;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: originX + p.x,
              top: originY + p.y,
              width: size,
              height: size,
              borderRadius: isSquare ? 2 : "50%",
              background: color,
              opacity: p.opacity,
              transform: `scale(${p.scale}) rotate(${rotation}deg)`,
            }}
          />
        );
      })}
    </>
  );
};
