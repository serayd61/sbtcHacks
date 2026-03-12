import { interpolate, spring } from "remotion";
import type { SpringConfig } from "remotion";
import { FPS } from "./layout";
import { SMOOTH } from "./springs";

export const fadeIn = (
  frame: number,
  startFrame: number,
  duration: number = 15
): number =>
  interpolate(frame, [startFrame, startFrame + duration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const fadeOut = (
  frame: number,
  startFrame: number,
  duration: number = 15
): number =>
  interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const slideIn = (
  frame: number,
  startFrame: number,
  direction: "left" | "right" | "up" | "down",
  distance: number = 80,
  config: SpringConfig = SMOOTH
): number => {
  const s = spring({
    fps: FPS,
    frame: Math.max(0, frame - startFrame),
    config,
  });
  const sign =
    direction === "right" || direction === "down" ? 1 : -1;
  return interpolate(s, [0, 1], [distance * sign, 0]);
};

export const slideUp = (
  frame: number,
  startFrame: number,
  distance: number = 60,
  config: SpringConfig = SMOOTH
): number => slideIn(frame, startFrame, "up", distance, config);

export const scaleIn = (
  frame: number,
  startFrame: number,
  config: SpringConfig = SMOOTH
): number => {
  const s = spring({
    fps: FPS,
    frame: Math.max(0, frame - startFrame),
    config,
  });
  return interpolate(s, [0, 1], [0, 1]);
};

export const typewriter = (
  frame: number,
  startFrame: number,
  text: string,
  charsPerFrame: number = 1.5
): string => {
  const elapsed = Math.max(0, frame - startFrame);
  const charCount = Math.min(
    text.length,
    Math.floor(elapsed * charsPerFrame)
  );
  return text.slice(0, charCount);
};

export const countUp = (
  frame: number,
  startFrame: number,
  endValue: number,
  duration: number = 60
): number => {
  const progress = interpolate(
    frame,
    [startFrame, startFrame + duration],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  return Math.floor(endValue * progress);
};

export const drawPath = (
  frame: number,
  startFrame: number,
  duration: number = 60
): number =>
  interpolate(frame, [startFrame, startFrame + duration], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const pulse = (
  frame: number,
  frequency: number = 0.05,
  amplitude: number = 0.05
): number => 1 + Math.sin(frame * frequency * Math.PI * 2) * amplitude;

export const particleBurst = (
  frame: number,
  startFrame: number,
  count: number,
  config: {
    spread?: number;
    gravity?: number;
    lifetime?: number;
  } = {}
): Array<{ x: number; y: number; opacity: number; scale: number }> => {
  const { spread = 300, gravity = 0.3, lifetime = 60 } = config;
  const elapsed = frame - startFrame;
  if (elapsed < 0 || elapsed > lifetime) return [];

  const particles: Array<{
    x: number;
    y: number;
    opacity: number;
    scale: number;
  }> = [];

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + i * 0.5;
    const speed = (spread / lifetime) * (0.5 + ((i * 7) % 10) / 10);
    const x = Math.cos(angle) * speed * elapsed;
    const y =
      Math.sin(angle) * speed * elapsed + gravity * elapsed * elapsed * 0.5;
    const opacity = interpolate(elapsed, [0, lifetime], [1, 0], {
      extrapolateRight: "clamp",
    });
    const scale = interpolate(elapsed, [0, lifetime * 0.3, lifetime], [0, 1, 0.3], {
      extrapolateRight: "clamp",
    });
    particles.push({ x, y, opacity, scale });
  }
  return particles;
};
