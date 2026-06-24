/**
 * WalletConnect-backed CantonProvider for @sigilry/react.
 *
 * Bridges the @sigilry/dapp WalletConnectTransport onto the `CantonProvider`
 * surface the React layer expects (`request` + `on`/`off`). With this, the same
 * hooks (useConnect, useLedgerApi, …) drive a WalletConnect session instead of
 * the injected `window.canton` provider — no other hook changes needed.
 *
 * `<CantonReactProvider walletConnect={config}>` calls this internally — you pass
 * the CONFIG (`WalletConnectTransportConfig`) to that prop, not this helper's
 * return value. Call this directly only when wiring a `CantonProvider` yourself.
 * The pairing URI is delivered via the `onUri` callback so the dApp can render a
 * QR / deep-link.
 */
import type { EventListener } from "@sigilry/dapp/provider";
import { WalletConnectTransport, type WalletConnectTransportConfig } from "@sigilry/dapp/transport";
import type { CantonProvider } from "./types";

export type { WalletConnectTransportConfig } from "@sigilry/dapp/transport";

export function createWalletConnectProvider(config: WalletConnectTransportConfig): CantonProvider {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  // Buffer ONLY connect-time bootstrap events (parity with the injected provider's
  // announce) so a `statusChanged`/`accountsChanged`/`connected` that arrives before
  // a listener attaches isn't dropped. Transient/high-volume events (e.g. txChanged,
  // emitted per prepareExecute) are NOT buffered — with no listener they're dropped
  // rather than retained for the provider's lifetime. Each kept event is bounded.
  const BUFFERED_EVENTS = new Set(["statusChanged", "accountsChanged", "connected"]);
  const MAX_BUFFER_PER_EVENT = 16;
  const buffer = new Map<string, unknown[][]>();

  const emit = (event: string, ...args: unknown[]): boolean => {
    const ls = listeners.get(event);
    if (ls && ls.size > 0) {
      for (const l of ls) l(...args);
      return true;
    }
    if (BUFFERED_EVENTS.has(event)) {
      const b = buffer.get(event) ?? [];
      b.push(args);
      if (b.length > MAX_BUFFER_PER_EVENT) b.shift(); // bounded — drop oldest, keep latest
      buffer.set(event, b);
    }
    return false;
  };

  const transport = new WalletConnectTransport({
    ...config,
    onEvent: (event, data) => emit(event, data),
  });

  // Conform to the CantonProvider (SpliceProvider) surface: `request` is the typed
  // RPC fn; on/emit/off/removeListener return the provider for chaining.
  const provider: CantonProvider = {
    request: (async ({ method, params }) => {
      const res = await transport.submit({
        method,
        params: params as Record<string, unknown> | undefined,
      });
      if ("error" in res) throw res.error;
      return res.result;
    }) as CantonProvider["request"],
    on<T = unknown>(event: string, listener: EventListener<T>): CantonProvider {
      const fn = listener as (...args: unknown[]) => void;
      const ls = listeners.get(event) ?? new Set<(...args: unknown[]) => void>();
      ls.add(fn);
      listeners.set(event, ls);
      const buffered = buffer.get(event);
      if (buffered) {
        for (const args of buffered) fn(...args);
        buffer.delete(event);
      }
      return provider;
    },
    emit,
    off<T = unknown>(event: string, listener: EventListener<T>): CantonProvider {
      listeners.get(event)?.delete(listener as (...args: unknown[]) => void);
      return provider;
    },
    removeListener<T = unknown>(event: string, listener: EventListener<T>): CantonProvider {
      listeners.get(event)?.delete(listener as (...args: unknown[]) => void);
      return provider;
    },
  };
  return provider;
}
