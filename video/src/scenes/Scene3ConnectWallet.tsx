import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { NavBar } from "../components/NavBar";
import { WalletPopup } from "../components/WalletPopup";
import { DashboardMock } from "../components/DashboardMock";
import { BG_BLACK } from "../lib/colors";

export const Scene3ConnectWallet: React.FC = () => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BG_BLACK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <BrowserFrame startFrame={0} url="sbtc-vault.app" width={1200} height={700}>
        {/* Navigation bar */}
        <NavBar startFrame={30} activeTab="Dashboard" />

        {/* Dashboard content */}
        <Sequence from={90}>
          <DashboardMock startFrame={0} />
        </Sequence>

        {/* Wallet popup overlay */}
        <div
          style={{
            position: "absolute",
            right: 20,
            top: 60,
          }}
        >
          <Sequence from={60} durationInFrames={200}>
            <WalletPopup startFrame={0} showConnected connectedFrame={50} />
          </Sequence>
        </div>
      </BrowserFrame>
    </AbsoluteFill>
  );
};
