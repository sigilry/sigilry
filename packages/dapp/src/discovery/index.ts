import "./window.js";

export { createProvider } from "./create-provider.js";
export {
  createDiscoveryStore,
  type DiscoveryStore,
  type DiscoveryStoreListener,
  type DiscoveryStoreMeta,
  type Listener,
  type Store,
} from "./store.js";
export type { DiscoveredWallet, SpliceAnnounceDetail, SpliceProviderInfo } from "./types.js";
export { announceProvider, requestProviders } from "./utils.js";
