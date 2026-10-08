import type { SpliceProvider } from "@sigilry/dapp";
import type {
  DiscoveredWallet as PublishedDiscoveredWallet,
  SpliceProviderInfo as PublishedSpliceProviderInfo,
  TransportOptions,
} from "@sigilry/dapp/discovery";
import type { Equal } from "../support/type-equal";

true satisfies Equal<SpliceProviderInfo, PublishedSpliceProviderInfo>;
true satisfies Equal<DiscoveredWallet, PublishedDiscoveredWallet>;
// ---cut---
type SpliceProviderInfo = {
  uuid: string;
  rdns: string;
  name: string;
  icon: `data:image/${string}`;
};
type DiscoveredWallet = {
  info: SpliceProviderInfo;
  getProvider(opts?: TransportOptions): SpliceProvider;
};
