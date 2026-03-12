import { AbsoluteFill, Audio, Sequence, staticFile } from "remotion";
import { BG_BLACK } from "./lib/colors";
import { Scene1Intro } from "./scenes/Scene1Intro";
import { Scene2WhatAreOptions } from "./scenes/Scene2WhatAreOptions";
import { Scene3ConnectWallet } from "./scenes/Scene3ConnectWallet";
import { Scene4BuyOption } from "./scenes/Scene4BuyOption";
import { Scene5TrackPosition } from "./scenes/Scene5TrackPosition";
import { Scene6HowYouWin } from "./scenes/Scene6HowYouWin";
import { Scene7HowYouLose } from "./scenes/Scene7HowYouLose";
import { Scene8CTA } from "./scenes/Scene8CTA";
import { SubtitleOverlay } from "./subtitles/SubtitleOverlay";

export const Video: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: BG_BLACK }}>
      {/* Voiceover */}
      <Audio src={staticFile("voiceover.mp3")} volume={1} />

      <Sequence from={0} durationInFrames={360}>
        <Scene1Intro />
      </Sequence>
      <Sequence from={360} durationInFrames={540}>
        <Scene2WhatAreOptions />
      </Sequence>
      <Sequence from={900} durationInFrames={450}>
        <Scene3ConnectWallet />
      </Sequence>
      <Sequence from={1350} durationInFrames={750}>
        <Scene4BuyOption />
      </Sequence>
      <Sequence from={2100} durationInFrames={450}>
        <Scene5TrackPosition />
      </Sequence>
      <Sequence from={2550} durationInFrames={810}>
        <Scene6HowYouWin />
      </Sequence>
      <Sequence from={3360} durationInFrames={540}>
        <Scene7HowYouLose />
      </Sequence>
      <Sequence from={3900} durationInFrames={420}>
        <Scene8CTA />
      </Sequence>

      {/* Subtitles overlay - spans entire video */}
      <SubtitleOverlay />
    </AbsoluteFill>
  );
};
