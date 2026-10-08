import { createDiscoveryStore } from "@sigilry/dapp/discovery";

const store = createDiscoveryStore();

const unsubscribe = store.subscribe(
  (wallets) => {
    // wallets: readonly DiscoveredWallet[]
    for (const w of wallets) console.log(w.info.rdns, w.info.name);
  },
  { emitImmediately: true },
);

// Build a live provider bound to a chosen wallet's transport target.
const provider = store.findProvider({ rdns: "it.send.connect" })?.getProvider();
console.log(provider);

// Teardown removes the window listeners.
unsubscribe();
store.destroy();
