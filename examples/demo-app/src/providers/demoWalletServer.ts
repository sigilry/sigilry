/* eslint-disable no-console */

import { announceProvider } from "@sigilry/dapp/discovery";
import type { SpliceAnnounceDetail } from "@sigilry/dapp/discovery";
import { isSpliceMessageEvent, WalletEvent } from "@sigilry/dapp/messages";
import type { ResponsePayload } from "@sigilry/dapp/messages";
import { isRpcError, RpcErrorCode, rpcError } from "@sigilry/dapp/rpc";
import { WindowTransport } from "@sigilry/dapp/transport";

import type { MockProvider } from "./MockProvider";

// Routing key the dApp-side WindowSpliceProvider stamps on every request frame it
// posts for this wallet. A real extension would scope its content-script messaging
// the same way; the value only needs to be unique among announced wallets.
const DEMO_WALLET_TARGET = "sigilry-demo-wallet";

// A tiny inline sigil so the picker entry is visually distinct from real wallets.
// `#` must be percent-encoded or the URL parser treats the rest of the SVG as a
// fragment and drops it — encodeURIComponent handles that (plus quotes/spaces).
const ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">' +
  '<rect width="40" height="40" rx="10" fill="#4f46e5"/>' +
  '<text x="20" y="27" font-family="sans-serif" font-size="22" font-weight="700" ' +
  'fill="#ffffff" text-anchor="middle">S</text></svg>';

// The discovery announcement for the demo wallet. `target` ties it to the in-page
// server below; `createProvider(detail)` (in @sigilry/dapp) builds a transport
// provider against this target when the dApp selects the wallet.
const demoWalletAnnounceDetail: SpliceAnnounceDetail = {
  id: "sigilry-demo-wallet",
  uuid: "a7c1e9d4-2b6f-4e8a-9c3d-5f0b1a2c3d4e",
  rdns: "org.sigilry.demo-wallet",
  name: "Sigilry Demo Wallet",
  icon: `data:image/svg+xml,${encodeURIComponent(ICON_SVG)}`,
  target: DEMO_WALLET_TARGET,
};

// Provider events the wallet pushes to the dApp. The dApp-side provider only
// receives these over the transport (it is a postMessage proxy, not the in-page
// instance), so the server must forward each one as a notification.
const FORWARDED_EVENTS = ["accountsChanged", "connected", "statusChanged", "txChanged"] as const;

/**
 * Run an in-page postMessage RPC server that exposes `provider` over the window
 * transport, faithfully mirroring how a real wallet extension serves a dApp.
 *
 * Why this exists: the discovery store only ever hands a dApp a *transport-backed*
 * provider for an announced wallet (`getProvider()` -> `createProvider(detail)` ->
 * `WindowSpliceProvider` over postMessage). There is no "announce an in-process
 * object" path. So for the demo's in-page `MockProvider` to be selectable from the
 * `WalletPicker` alongside real wallets, the demo must play the wallet's content
 * script: accept request frames, route them to the in-process provider, and push
 * its events back as notifications.
 *
 * Caveat: the dApp-side provider is built by the store with `createProvider(detail)`
 * and no transport options, so it inherits the SDK's fixed 30s request timeout.
 * Approval-gated calls (`prepareExecuteAndWait`, `signMessage`) therefore require the
 * user to approve in the right-hand pane within 30s — the in-process path had no
 * such ceiling. Tracked for an SDK fix in sigilry/sigilry-private#83.
 *
 * @returns a cleanup function that stops the server and removes event forwarding.
 */
export function startDemoWalletServer(provider: MockProvider): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  // Reused only for its framing helpers (submitResponse / notify); it posts to the
  // same window the dApp-side provider listens on.
  const transport = new WindowTransport(window, { target: DEMO_WALLET_TARGET });

  // The in-process provider's request() is a discriminated TypedRequestFn; the wire
  // hands us an opaque (method, params), so route through a structural signature.
  const requestProvider = provider.request as unknown as (payload: {
    method: string;
    params?: unknown;
  }) => Promise<unknown>;

  // Route one dApp request to the in-process provider, wrapping the outcome into a
  // JSON-RPC response payload (mirrors createCantonServer's success/error contract).
  const dispatch = async (method: string, params: unknown): Promise<ResponsePayload> => {
    try {
      const result = await requestProvider({ method, params });
      return { result };
    } catch (error) {
      if (isRpcError(error)) {
        return { error };
      }
      const message = error instanceof Error ? error.message : String(error);
      return { error: rpcError(RpcErrorCode.INTERNAL_ERROR, message) };
    }
  };

  const onMessage = (event: MessageEvent): void => {
    if (!isSpliceMessageEvent(event)) {
      return;
    }
    const data = event.data;
    if (data.type !== WalletEvent.SPLICE_WALLET_REQUEST) {
      return;
    }
    // Only handle frames addressed to this wallet. The dApp stamps detail.target on
    // every request; frames for other wallets (e.g. Send Connect) carry their target.
    if (data.target !== DEMO_WALLET_TARGET) {
      return;
    }
    const { id, method, params } = data.request;
    // Id-less frames are wallet-pushed notifications (including our own forwarded
    // events bouncing on the same window) — never requests. Ignore them.
    if (id === undefined || id === null) {
      return;
    }
    void dispatch(method, params).then((response) => {
      transport.submitResponse(id, response);
    });
  };

  window.addEventListener("message", onMessage);

  const stopForwarding = FORWARDED_EVENTS.map((eventName) => {
    const handler = (payload: unknown): void => {
      transport.notify(eventName, payload, DEMO_WALLET_TARGET);
    };
    provider.on(eventName, handler);
    return () => provider.removeListener(eventName, handler);
  });

  console.debug("[demo-wallet] server listening", { target: DEMO_WALLET_TARGET });

  return () => {
    window.removeEventListener("message", onMessage);
    for (const off of stopForwarding) {
      off();
    }
  };
}

// Convenience for the no-extension story: announce the demo wallet on the discovery
// channel. Kept separate from the server so the two wallet responsibilities — serve
// RPC, advertise yourself — read distinctly in main.tsx.
export function announceDemoWallet(): () => void {
  return announceProvider(demoWalletAnnounceDetail);
}
