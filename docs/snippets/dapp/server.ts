import {
  createCantonServer,
  createStubHandlers,
  isSpliceMessageEvent,
  jsonRpcResponse,
  WalletEvent,
} from "@sigilry/dapp";

const server = createCantonServer({
  ...createStubHandlers(),
  status: async () => ({
    provider: { id: "send-extension", providerType: "browser" },
    connection: { isConnected: true, isNetworkConnected: true },
  }),
  connect: async () => ({
    isConnected: true,
    isNetworkConnected: true,
  }),
  disconnect: async () => null,
  getActiveNetwork: async () => ({ networkId: "canton:localnet" }),
  listAccounts: async () => [],
  getPrimaryAccount: async () => ({
    primary: true,
    partyId: "alice::1220abc123",
    status: "allocated",
    hint: "alice",
    publicKey: "ed25519:abc123",
    namespace: "1220abc123",
    networkId: "canton:localnet",
    signingProviderId: "passkey",
  }),
  prepareExecute: async () => null,
  prepareExecuteAndWait: async () => ({
    tx: {
      status: "executed",
      commandId: "cmd-123",
      payload: { updateId: "update-1", completionOffset: 1 },
    },
  }),
  // Stub only: DER ECDSA integers r=1, s=1, encoded as hex; not a valid message signature.
  signMessage: async () => ({ signature: "3006020101020101" }),
  ledgerApi: async () => ({ events: [] }),
});

window.addEventListener("message", async (event) => {
  if (!isSpliceMessageEvent(event)) return;
  if (event.data.type !== WalletEvent.SPLICE_WALLET_REQUEST) return;

  const { id, method, params } = event.data.request;
  const response = await server.handleRequest(method, params);
  // JSON-RPC notifications carry no id and receive no response.
  if (id === undefined) return;

  window.postMessage(
    {
      type: WalletEvent.SPLICE_WALLET_RESPONSE,
      response: jsonRpcResponse(id, response),
    },
    "*",
  );
});
