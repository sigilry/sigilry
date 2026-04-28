import "./testDom";

import { afterEach, beforeEach } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { CantonReactProvider } from "../src/context.js";
import type { CantonProvider, ParsedError } from "../src/types.js";

type RpcRequest = {
  method: string;
  params?: unknown;
};

type RpcHandler = (request: RpcRequest) => Promise<unknown> | unknown;
type EventHandler = (...args: unknown[]) => void;

export const TEST_NETWORK_ID = "canton:localnet";

export const TEST_ACCOUNT = {
  primary: true,
  partyId: "alice::1220",
  status: "initialized",
  hint: "alice",
  publicKey: "pk-alice",
  namespace: "1220",
  networkId: TEST_NETWORK_ID,
  signingProviderId: "sp-alice",
} as const;

export const CONNECTED_STATUS = {
  provider: { id: "sendwallet" },
  connection: {
    isConnected: true,
    isNetworkConnected: true,
  },
  network: {
    networkId: TEST_NETWORK_ID,
  },
} as const;

export const DISCONNECTED_STATUS = {
  provider: { id: "sendwallet" },
  connection: {
    isConnected: false,
    reason: "Not connected",
    isNetworkConnected: false,
    networkReason: "Not connected",
  },
} as const;

export function createMockProvider(handler: RpcHandler): CantonProvider & {
  calls: RpcRequest[];
  emit: (event: string, ...args: unknown[]) => void;
} {
  const listeners = new Map<string, Set<EventHandler>>();
  const calls: RpcRequest[] = [];

  return {
    calls,
    async request(request) {
      calls.push(request);
      return await handler(request);
    },
    on(event, listener) {
      const handlers = listeners.get(event) ?? new Set<EventHandler>();
      handlers.add(listener);
      listeners.set(event, handlers);
    },
    off(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    removeListener(event, listener) {
      listeners.get(event)?.delete(listener);
    },
    emit(event, ...args) {
      for (const listener of listeners.get(event) ?? []) {
        listener(...args);
      }
    },
  };
}

export function installMockProvider(provider: CantonProvider): void {
  (window as Window & { canton?: CantonProvider }).canton = provider;
}

export function createHookWrapper(
  options: {
    onError?: (error: ParsedError) => void;
  } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <CantonReactProvider onError={options.onError}>{children}</CantonReactProvider>
      </QueryClientProvider>
    );
  }

  return { Wrapper, queryClient };
}

/**
 * Register per-test isolation hooks (clear window.canton and the DOM) for the
 * CURRENT test file. Must be called at module top level of each test file
 * that installs mock providers.
 *
 * Why this exists as a function instead of module-level hooks: bun:test
 * registers module-level `beforeEach`/`afterEach` from an imported helper
 * module only once — for the first test file that happens to import the
 * helper. Subsequent test files do not re-run the registration (the module
 * is cached). Calling this from each test file's module top level
 * re-registers the hooks in that file's scope.
 */
export function registerTestIsolation(): void {
  beforeEach(() => {
    const w = window as Window & { canton?: CantonProvider };
    delete w.canton;
    (w as { canton?: unknown }).canton = undefined;
    document.body.innerHTML = "";
  });

  afterEach(() => {
    cleanup();
    const w = window as Window & { canton?: CantonProvider };
    delete w.canton;
    (w as { canton?: unknown }).canton = undefined;
    document.body.innerHTML = "";
  });
}

export { act, renderHook, waitFor };
