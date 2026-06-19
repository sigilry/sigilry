import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { DemoLayout } from "./components/layout";
import { App } from "./App";
import { demoWalletProvider } from "./providers/demoWallet";
import { announceDemoWallet, startDemoWalletServer } from "./providers/demoWalletServer";
import { installMockProvider } from "./providers/MockProvider";
import { WalletSimulatorProvider } from "./providers/WalletSimulator";
import "./styles.css";

// Mirror a real wallet extension, synchronously before React mounts so discovery sees the
// wallet on its very first read. A real extension does three things, so the demo does too:
//   1. inject window.canton (the legacy single-provider fallback, surfaced by useDiscovery
//      only when nothing announces);
//   2. serve RPC over the window transport, so an announced wallet is actually usable;
//   3. announce itself over canton:announceProvider, so WalletPicker lists it alongside any
//      real installed wallet (e.g. Send Connect) — the multi-wallet discovery this demo shows.
installMockProvider(demoWalletProvider);
startDemoWalletServer(demoWalletProvider);
announceDemoWallet();

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WalletSimulatorProvider provider={demoWalletProvider}>
        <DemoLayout dapp={<App />} />
      </WalletSimulatorProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
