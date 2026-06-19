import React from "react";

import { WalletGate } from "../dapp/WalletGate";
import { WalletPane } from "../wallet/WalletPane";
import { SplitPane } from "./SplitPane";

interface DemoLayoutProps {
  // The dApp UI, rendered in the left pane behind the discovery WalletGate. The wallet-simulator
  // pane on the right reads WalletSimulatorContext, provided above this layout in main.tsx.
  dapp: React.ReactNode;
}

export const DemoLayout = ({ dapp }: DemoLayoutProps) => (
  <SplitPane left={<WalletGate>{dapp}</WalletGate>} right={<WalletPane />} />
);
