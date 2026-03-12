import { interpolate, useCurrentFrame } from "remotion";
import {
  BG_CARD,
  BORDER_CARD,
  TEXT_SECONDARY,
  GREEN_ITM,
  ORANGE_OTM,
  BTC_ORANGE,
  TEXT_PRIMARY,
} from "../lib/colors";
import { drawPath, fadeIn } from "../lib/animations";

export const PriceChart: React.FC<{
  startFrame?: number;
  drawDuration?: number;
  strikePrice?: number;
  dataPoints?: number[];
  width?: number;
  height?: number;
  showStrikeLine?: boolean;
  showITMZone?: boolean;
}> = ({
  startFrame = 0,
  drawDuration = 90,
  strikePrice = 90000,
  dataPoints = [85000, 84000, 86000, 88000, 87000, 89000, 91000, 93000, 95000, 97000, 100000],
  width = 700,
  height = 350,
  showStrikeLine = true,
  showITMZone = false,
}) => {
  const frame = useCurrentFrame();
  const f = Math.max(0, frame - startFrame);

  const opacity = fadeIn(frame, startFrame, 15);
  const pathProgress = interpolate(f, [15, 15 + drawDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const padding = { top: 30, right: 20, bottom: 40, left: 80 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const min = Math.min(...dataPoints, strikePrice) - 2000;
  const max = Math.max(...dataPoints, strikePrice) + 2000;

  const toX = (i: number) =>
    padding.left + (i / (dataPoints.length - 1)) * chartW;
  const toY = (v: number) =>
    padding.top + chartH - ((v - min) / (max - min)) * chartH;

  const strikeY = toY(strikePrice);

  // Build path
  const visiblePoints = Math.floor(pathProgress * dataPoints.length);
  let pathD = "";
  for (let i = 0; i <= visiblePoints && i < dataPoints.length; i++) {
    const x = toX(i);
    const y = toY(dataPoints[i]);
    pathD += i === 0 ? `M${x},${y}` : ` L${x},${y}`;
  }

  // Current point
  const currentIdx = Math.min(visiblePoints, dataPoints.length - 1);
  const currentX = toX(currentIdx);
  const currentY = toY(dataPoints[currentIdx]);
  const isITM = dataPoints[currentIdx] > strikePrice;

  // Y-axis labels
  const yLabels = Array.from({ length: 5 }, (_, i) => {
    const val = min + ((max - min) * i) / 4;
    return { y: toY(val), label: `$${(val / 1000).toFixed(0)}K` };
  });

  return (
    <div style={{ opacity, position: "relative" }}>
      <svg width={width} height={height}>
        {/* Background grid */}
        {yLabels.map(({ y, label }, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={y}
              y2={y}
              stroke={BORDER_CARD}
              strokeWidth={1}
            />
            <text
              x={padding.left - 10}
              y={y + 4}
              textAnchor="end"
              fill={TEXT_SECONDARY}
              fontSize={13}
              fontFamily="Inter, sans-serif"
            >
              {label}
            </text>
          </g>
        ))}

        {/* Strike line */}
        {showStrikeLine && (
          <>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={strikeY}
              y2={strikeY}
              stroke={ORANGE_OTM}
              strokeWidth={2}
              strokeDasharray="8 4"
              opacity={fadeIn(frame, startFrame + 10, 20)}
            />
            <text
              x={width - padding.right + 5}
              y={strikeY + 4}
              fill={ORANGE_OTM}
              fontSize={13}
              fontFamily="Inter, sans-serif"
              fontWeight="bold"
            >
              Strike
            </text>
          </>
        )}

        {/* ITM zone fill */}
        {showITMZone && visiblePoints > 0 && (
          <path
            d={`${pathD} L${currentX},${strikeY} L${toX(0)},${strikeY} Z`}
            fill={isITM ? `${GREEN_ITM}15` : `${ORANGE_OTM}15`}
          />
        )}

        {/* Price line */}
        <path
          d={pathD}
          fill="none"
          stroke={isITM ? GREEN_ITM : BTC_ORANGE}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Current point */}
        {visiblePoints > 0 && (
          <>
            <circle
              cx={currentX}
              cy={currentY}
              r={8}
              fill={isITM ? GREEN_ITM : BTC_ORANGE}
              opacity={0.3}
            />
            <circle
              cx={currentX}
              cy={currentY}
              r={5}
              fill={isITM ? GREEN_ITM : BTC_ORANGE}
            />
          </>
        )}
      </svg>
    </div>
  );
};
