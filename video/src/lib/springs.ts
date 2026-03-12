import type { SpringConfig } from "remotion";

export const BOUNCY: SpringConfig = {
  damping: 8,
  mass: 0.5,
  stiffness: 100,
  overshootClamping: false,
};

export const SMOOTH: SpringConfig = {
  damping: 15,
  mass: 1,
  stiffness: 80,
  overshootClamping: false,
};

export const SNAPPY: SpringConfig = {
  damping: 12,
  mass: 0.3,
  stiffness: 200,
  overshootClamping: false,
};

export const OVERSHOOT: SpringConfig = {
  damping: 6,
  mass: 0.4,
  stiffness: 150,
  overshootClamping: false,
};
