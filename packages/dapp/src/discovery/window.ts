import type { SpliceAnnounceDetail } from "./types.js";

declare global {
  interface WindowEventMap {
    "canton:announceProvider": CustomEvent<SpliceAnnounceDetail>;
    "canton:requestProvider": CustomEvent<void>;
  }
}

export {};
