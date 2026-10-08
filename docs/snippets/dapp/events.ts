import type { SpliceProvider } from "@sigilry/dapp";
import type { StatusEvent } from "@sigilry/dapp/schemas";
declare const provider: SpliceProvider;
// ---cut---
const onStatus = (status: StatusEvent) => {
  /* ongoing status changes: network, session, disconnect */
  console.log(status);
};
provider.on("statusChanged", onStatus);
provider.on("connected", (status) => {
  /* login-flow completion (login event, not §4.2.2) */
  console.log(status);
});
provider.on("accountsChanged", (accounts) => {
  /* active account / session changes */
  console.log(accounts);
});
provider.on("txChanged", (tx) => {
  /* transaction updates */
  console.log(tx);
});

// Unsubscribe:
provider.removeListener("statusChanged", onStatus);
