import type { DiscoveredWallet } from "@sigilry/dapp/discovery";
declare function render(wallets: readonly DiscoveredWallet[]): void;
// ---cut---
import { createDiscoveryStore } from "@sigilry/dapp/discovery";

const store = createDiscoveryStore();

// React to the live provider set; `emitImmediately` fires once with the current snapshot.
const unsubscribe = store.subscribe(
  (wallets, meta) => {
    render(wallets); // wallets: readonly DiscoveredWallet[]
    console.log(meta?.added, meta?.removed);
  },
  { emitImmediately: true },
);

// Look one up by identity, then build a live provider from it.
const wallet = store.findProvider({ rdns: "it.send.connect" });
const provider = wallet?.getProvider(); // a SpliceProvider bound to that target

// Teardown removes the window listeners.
store.destroy();
