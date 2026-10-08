declare function App(): React.ReactNode;
// ---cut---
import { useState } from "react";
import {
  CantonReactProvider,
  useDiscovery,
  WalletPicker,
  type DiscoveredWallet,
} from "@sigilry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SpliceProvider } from "@sigilry/dapp";

const queryClient = new QueryClient();

function WalletGate({ children }: { children: React.ReactNode }) {
  const wallets = useDiscovery();
  const [provider, setProvider] = useState<SpliceProvider | null>(null);

  if (!provider) {
    return (
      <WalletPicker
        wallets={wallets}
        onSelect={(w: DiscoveredWallet) => setProvider(w.getProvider())}
        emptyState={<p>No Canton wallet detected.</p>}
      />
    );
  }

  // The controlled `provider` prop binds every hook below to the chosen wallet.
  return <CantonReactProvider provider={provider}>{children}</CantonReactProvider>;
}

export function AppRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletGate>
        <App />
      </WalletGate>
    </QueryClientProvider>
  );
}
