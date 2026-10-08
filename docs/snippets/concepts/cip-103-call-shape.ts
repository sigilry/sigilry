// Types `window.canton?: SpliceProvider`; optional because no wallet may be injected.
import "@sigilry/dapp/browser-globals";

// Canonical CIP-103 call shape
const status = await window.canton?.request({ method: "status" });

// Event subscription
window.canton?.on("accountsChanged", (accounts) => {
  /* ... */
});
