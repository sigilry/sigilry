import { MockProvider } from "./MockProvider";

// Wallet/ledger configuration for the simulated provider. Overridable via Vite env so the
// demo can point at a different localnet party/user without code changes.
export const NETWORK_ID = "canton:localnet";
export const LEDGER_PARTY_ID = import.meta.env.VITE_LEDGER_PARTY_ID ?? "Alice";
export const LEDGER_USER_ID = import.meta.env.VITE_LEDGER_USER_ID ?? "ledger-api-user";
export const LEDGER_API_BASE_PATH = import.meta.env.VITE_LEDGER_API_BASE_PATH ?? "/ledger";

// A single simulated wallet provider, shared by the wallet-simulator pane (which wires up its
// keypair/accounts/approval queue) and the dApp pane (which discovers and binds to it).
//
// It is constructed at module load so `main.tsx` can install it onto `window.canton`
// synchronously, before React mounts. That ordering matters: a real wallet extension injects
// `window.canton` before the dApp script runs, and the discovery store's injected-provider
// fallback (surfaced by `useDiscovery`) only observes a provider that already exists when it is
// first read. Constructing here touches no browser globals — the install side effect lives in
// `main.tsx` — so this module stays import-safe for typecheck and unit tests.
export const demoWalletProvider = new MockProvider({
  networkId: NETWORK_ID,
  ledgerUserId: LEDGER_USER_ID,
  ledgerApiBasePath: LEDGER_API_BASE_PATH,
});
