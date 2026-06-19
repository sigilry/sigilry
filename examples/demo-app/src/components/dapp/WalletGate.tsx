import { useState, type ReactNode } from "react";
import { CantonReactProvider, useDiscovery, WalletPicker } from "@sigilry/react";
import type { DiscoveredWallet } from "@sigilry/react";
import type { SpliceProvider } from "@sigilry/dapp/provider";

import { InfoTooltip } from "../shared/InfoTooltip";
import { docsLinks } from "../../lib/docs";

interface WalletGateProps {
  children: ReactNode;
}

/**
 * Gates the dApp behind provider discovery. `useDiscovery()` surfaces the wallets that have
 * announced themselves (and, when none have, the injected `window.canton` as a fallback);
 * `WalletPicker` renders them; the chosen wallet's provider is bound to every Sigilry hook below
 * via `CantonReactProvider`'s controlled `provider` prop.
 *
 * This demo's wallet announces itself over `canton:announceProvider` (backed by an in-page RPC
 * server — see `providers/demoWalletServer.ts`), exactly like a real extension, so it appears as
 * "Sigilry Demo Wallet". Any real wallet you have installed (e.g. Send Connect) announces too and
 * the picker lists them side by side — that is the multi-wallet discovery this demo exists to show.
 */
export const WalletGate = ({ children }: WalletGateProps) => {
  const wallets = useDiscovery();
  const [provider, setProvider] = useState<SpliceProvider | null>(null);

  if (provider) {
    // The controlled `provider` prop binds every hook in `children` to the selected wallet.
    return <CantonReactProvider provider={provider}>{children}</CantonReactProvider>;
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-title">
          <p className="eyebrow">Sigilry Demo</p>
          <h1>Discover a wallet</h1>
          <p className="subtitle">
            Choose a Canton wallet to connect. Sigilry discovers wallets with{" "}
            <code>useDiscovery()</code> and renders them with <code>WalletPicker</code>.
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div className="title-row">
            <h2>Available wallets</h2>
            <InfoTooltip
              label="Provider discovery"
              description="useDiscovery() returns the wallets that announced over canton:announceProvider, falling back to the injected window.canton provider. Selecting one binds it to every hook via CantonReactProvider's provider prop."
              href={docsLinks.discovery}
            />
          </div>
        </div>
        <WalletPicker
          className="wallet-picker"
          wallets={wallets}
          onSelect={(wallet: DiscoveredWallet) => setProvider(wallet.getProvider())}
          emptyState={
            // WalletPicker wraps emptyState in its own <p>, so this must be inline content.
            <span className="muted">
              No Canton wallet detected. The demo wallet announces itself shortly.
            </span>
          }
        />
        <p className="muted small">
          The demo wallet announces itself like a real extension, so it appears here as “Sigilry
          Demo Wallet”. Any wallet you have installed (e.g. Send Connect) announces too and the
          picker lists them all — pick the demo wallet to drive the local sandbox.
        </p>
      </section>
    </div>
  );
};
