import type { SpliceProvider } from "../provider/interface.js";
import type { TransportOptions } from "../transport/types.js";

export type SpliceAnnounceDetail = {
  id: string;
  name: string;
  icon: `data:image/${string}`;
  target: string;
  rdns: string;
  uuid: string;
};

export type SpliceProviderInfo = {
  uuid: string;
  rdns: string;
  name: string;
  icon: `data:image/${string}`;
};

export type DiscoveredWallet = {
  info: SpliceProviderInfo;
  getProvider(opts?: TransportOptions): SpliceProvider;
};
