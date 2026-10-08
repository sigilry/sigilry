import type { SpliceProvider } from "@sigilry/dapp";
import "@sigilry/dapp/browser-globals";

async function connectToTestnet(provider: SpliceProvider) {
  const connection = await provider.request({ method: "connect" });
  if (!connection.isConnected || connection.isNetworkConnected === false) {
    throw new Error("Wallet connection is not ready");
  }

  const network = await provider.request({ method: "getActiveNetwork" });
  if (network.networkId !== "canton:testnet") {
    throw new Error("Select Testnet in the Send Connect popup, then reconnect");
  }

  return provider.request({ method: "listAccounts" });
}

if (!window.canton) throw new Error("Install Send Connect and reload the dApp");
const accounts = await connectToTestnet(window.canton);
console.log(accounts.map(({ partyId, networkId }) => ({ partyId, networkId })));
