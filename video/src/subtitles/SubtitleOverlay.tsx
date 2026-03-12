import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { SUBTITLES } from "./parseSrt";
import { TEXT_PRIMARY } from "../lib/colors";

export const SubtitleOverlay: React.FC = () => {
  const frame = useCurrentFrame();

  const currentCue = SUBTITLES.find(
    (cue) => frame >= cue.startFrame && frame <= cue.endFrame
  );

  if (!currentCue) return null;

  const fadeInOpacity = interpolate(
    frame,
    [currentCue.startFrame, currentCue.startFrame + 5],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const fadeOutOpacity = interpolate(
    frame,
    [currentCue.endFrame - 5, currentCue.endFrame],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: "50%",
          transform: "translateX(-50%)",
          backgroundColor: "rgba(0, 0, 0, 0.8)",
          padding: "12px 32px",
          borderRadius: 12,
          opacity,
          maxWidth: "80%",
          textAlign: "center",
        }}
      >
        {currentCue.text.split("\n").map((line, i) => (
          <div
            key={i}
            style={{
              color: TEXT_PRIMARY,
              fontSize: 32,
              fontFamily: "Inter, sans-serif",
              fontWeight: 500,
              lineHeight: 1.4,
              letterSpacing: 0.5,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
