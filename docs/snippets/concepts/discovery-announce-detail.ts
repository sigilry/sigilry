import type { SpliceAnnounceDetail as Published } from "@sigilry/dapp/discovery";
import type { Equal } from "../support/type-equal";

true satisfies Equal<SpliceAnnounceDetail, Published>;
// ---cut---
type SpliceAnnounceDetail = {
  id: string; // provider id (e.g. the extension id)
  name: string; // human label, e.g. "Send Connect"
  icon: `data:image/${string}`; // inline icon
  target: string; // the postMessage target the provider listens on
  rdns: string; // reverse-DNS identity, e.g. "it.send.connect"
  uuid: string; // stable per-announcement id
};
