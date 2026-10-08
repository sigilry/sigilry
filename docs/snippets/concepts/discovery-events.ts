import { createDiscoveryStore } from "@sigilry/dapp/discovery";
const store = createDiscoveryStore();
// ---cut---
const provider = store.findProvider({ rdns: "it.send.connect" })?.getProvider();

provider?.on("statusChanged", (status) => {
  /* §4.2.2 ongoing status change */
});
provider?.on("accountsChanged", (accounts) => {
  /* §4.2.2 active-account / session change */
});
provider?.on("connected", (status) => {
  /* login-flow completion (login event, not §4.2.2) */
});
