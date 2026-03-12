import { Composition } from "remotion";
import { Video } from "./Video";
import { FPS, HEIGHT, TOTAL_DURATION_FRAMES, WIDTH } from "./lib/layout";

export const Root: React.FC = () => {
  return (
    <Composition
      id="SBTCExplainer"
      component={Video}
      durationInFrames={TOTAL_DURATION_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  );
};
