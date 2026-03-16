import React from "react";

import { WalletSimulatorProvider } from "../../providers/WalletSimulator";
import { WalletPane } from "../wallet/WalletPane";
import { SplitPane } from "./SplitPane";

interface DemoLayoutProps {
  children: React.ReactNode;
}

export const DemoLayout = ({ children }: DemoLayoutProps) => (
  <WalletSimulatorProvider>
    <SplitPane left={children} right={<WalletPane />} />
  </WalletSimulatorProvider>
);
