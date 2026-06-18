import "./testDom";

import { describe, expect, test } from "bun:test";
import { announceProvider } from "@sigilry/dapp/discovery";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { CantonReactProvider, useCanton } from "../src/context.js";
import { useDiscovery } from "../src/discovery.js";
import type { DiscoveredWallet } from "../src/discovery.js";
import type { CantonContextValue } from "../src/context.js";
import type { CantonProvider, ParsedError } from "../src/types.js";
import {
  TEST_ACCOUNT,
  act,
  createHookWrapper,
  createMockProvider,
  installMockProvider,
  registerTestIsolation,
  renderHook,
  waitFor,
} from "./testUtils.js";

registerTestIsolation();

describe("useDiscovery", () => {
  test("surfaces the injected window.canton fallback when nothing is announced", async () => {
    const provider = createMockProvider(({ method }) => {
      throw new Error(`Unhandled method: ${method}`);
    });
    installMockProvider(provider);

    const { result } = renderHook(() => useDiscovery());

    await waitFor(() => {
      expect(result.current).toHaveLength(1);
    });

    expect(result.current[0]?.info).toMatchObject({
      uuid: "canton.injected",
      rdns: "canton.injected",
      name: "Injected Canton Provider",
    });
    expect(result.current[0]?.getProvider()).toBe(provider);
  });

  test("reacts to announced wallets", async () => {
    const { result } = renderHook(() => useDiscovery());

    let stopAnnouncing = () => {};
    await act(async () => {
      stopAnnouncing = announceProvider({
        id: "wallet-target",
        name: "Send Wallet",
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" />',
        target: "wallet-target",
        rdns: "it.send.wallet",
        uuid: "wallet-uuid",
      });
    });

    try {
      await waitFor(() => {
        expect(result.current.map((wallet) => wallet.info.uuid)).toContain("wallet-uuid");
      });

      expect(result.current[0]?.info).toEqual({
        uuid: "wallet-uuid",
        rdns: "it.send.wallet",
        name: "Send Wallet",
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" />',
      });
    } finally {
      stopAnnouncing();
    }
  });

  test("uses a stable empty server snapshot without touching window", async () => {
    const originalWindow = globalThis.window;
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
      writable: true,
    });

    try {
      const { getDiscoveryServerSnapshot } = await import("../src/discovery.js");
      const first = getDiscoveryServerSnapshot();
      const second = getDiscoveryServerSnapshot();
      expect(first).toBe(second);
      expect(first).toEqual([]);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: originalWindow,
        writable: true,
      });
    }
  });
});

describe("WalletPicker", () => {
  test("renders a selectable entry for each wallet", async () => {
    const { WalletPicker } = await import("../src/discovery.js");
    const selected: DiscoveredWallet[] = [];
    const wallets: readonly DiscoveredWallet[] = [
      {
        info: {
          uuid: "wallet-a",
          rdns: "it.send.a",
          name: "Wallet A",
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" />',
        },
        getProvider: () =>
          createMockProvider(({ method }) => {
            throw new Error(`Unhandled method: ${method}`);
          }),
      },
      {
        info: {
          uuid: "wallet-b",
          rdns: "it.send.b",
          name: "Wallet B",
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" />',
        },
        getProvider: () =>
          createMockProvider(({ method }) => {
            throw new Error(`Unhandled method: ${method}`);
          }),
      },
    ];

    const view = render(
      <WalletPicker
        wallets={wallets}
        onSelect={(wallet) => {
          selected.push(wallet);
        }}
      />,
    );

    expect(view.getByRole("button", { name: "Wallet A" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Wallet B" })).toBeTruthy();
    expect(view.getByAltText("Wallet A")).toBeTruthy();
    expect(view.getByAltText("Wallet B")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Wallet B" }));

    expect(selected).toEqual([wallets[1]]);
  });

  test("renders an explicit empty state", async () => {
    const { WalletPicker } = await import("../src/discovery.js");

    const view = render(<WalletPicker wallets={[]} onSelect={() => {}} />);

    expect(view.getByText("No wallets found")).toBeTruthy();
    expect(view.queryAllByRole("button")).toHaveLength(0);
  });
});

describe("CantonReactProvider provider prop", () => {
  function ProviderHarness({
    children,
    initGraceMs,
    onError,
    onSnapshot,
    provider,
  }: PropsWithChildren<{
    initGraceMs?: number;
    onError?: (error: ParsedError) => void;
    onSnapshot?: (value: CantonContextValue) => void;
    provider?: CantonProvider | null;
  }>) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
        mutations: { retry: false },
      },
    });

    function Probe() {
      const value = useCanton();
      onSnapshot?.(value);
      return (
        <output aria-label="connection-status">
          {value.providerReady ? "ready" : "not-ready"}:{value.connectionState.status}
        </output>
      );
    }

    return (
      <QueryClientProvider client={queryClient}>
        <CantonReactProvider initGraceMs={initGraceMs} onError={onError} provider={provider}>
          <Probe />
          {children}
        </CantonReactProvider>
      </QueryClientProvider>
    );
  }

  test("prefers the injected provider prop over window.canton", async () => {
    const propProvider = createMockProvider(({ method }) => {
      if (method === "status") {
        return {
          provider: { id: "prop" },
          connection: { isConnected: true, isNetworkConnected: true },
          network: { networkId: TEST_ACCOUNT.networkId },
        };
      }
      if (method === "listAccounts") {
        return [TEST_ACCOUNT];
      }
      throw new Error(`Unhandled method: ${method}`);
    });
    const windowProvider = createMockProvider(({ method }) => {
      throw new Error(`window provider should not receive ${method}`);
    });
    installMockProvider(windowProvider);

    const { useCanton } = await import("../src/context.js");
    const { createHookWrapper } = await import("./testUtils.js");
    const { Wrapper } = createHookWrapper({ provider: propProvider });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.providerReady).toBe(true);
      expect(result.current.connectionState.status).toBe("connected");
    });

    expect(propProvider.calls.map(({ method }) => method)).toContain("status");
    expect(windowProvider.calls).toEqual([]);
  });

  test("tears down the previous provider and bootstraps after a provider switch", async () => {
    const accountA = {
      ...TEST_ACCOUNT,
      partyId: "alice-a::1220",
      hint: "alice-a",
      publicKey: "pk-a",
      signingProviderId: "sp-a",
    };
    const accountB = {
      ...TEST_ACCOUNT,
      partyId: "alice-b::1220",
      hint: "alice-b",
      publicKey: "pk-b",
      signingProviderId: "sp-b",
    };
    const providerA = createMockProvider(({ method }) => {
      if (method === "status") {
        return {
          provider: { id: "a" },
          connection: { isConnected: true, isNetworkConnected: true },
          network: { networkId: accountA.networkId },
        };
      }
      if (method === "listAccounts") {
        return [accountA];
      }
      throw new Error(`Unhandled method: ${method}`);
    });
    const providerB = createMockProvider(({ method }) => {
      if (method === "status") {
        return {
          provider: { id: "b" },
          connection: { isConnected: true, isNetworkConnected: true },
          network: { networkId: accountB.networkId },
        };
      }
      if (method === "listAccounts") {
        return [accountB];
      }
      throw new Error(`Unhandled method: ${method}`);
    });

    const view = render(<ProviderHarness provider={providerA} />);

    await waitFor(() => {
      expect(view.getByLabelText("connection-status").textContent).toBe("ready:connected");
    });

    view.rerender(<ProviderHarness provider={providerB} />);

    await waitFor(() => {
      expect(providerA.listenerCount("accountsChanged")).toBe(0);
      expect(providerA.listenerCount("txChanged")).toBe(0);
      expect(providerA.listenerCount("statusChanged")).toBe(0);
      expect(providerA.listenerCount("connected")).toBe(0);
      expect(view.getByLabelText("connection-status").textContent).toBe("ready:connected");
    });

    expect(providerA.offCalls.map(({ event }) => event)).toEqual(
      expect.arrayContaining(["accountsChanged", "txChanged", "statusChanged", "connected"]),
    );
    expect(providerB.calls.map(({ method }) => method)).toContain("status");
  });

  test("waits without an extension error when controlled provider selection is empty", async () => {
    const onErrorCalls: ParsedError[] = [];

    const { result } = renderHook(() => useCanton(), {
      wrapper: createHookWrapper({
        onError: (error) => {
          onErrorCalls.push(error);
        },
        provider: undefined,
      }).Wrapper,
    });

    await waitFor(() => {
      expect(result.current.providerReady).toBe(false);
      expect(result.current.connectionState).toEqual({ status: "disconnected" });
    });

    expect(onErrorCalls).toEqual([]);
  });

  test("ignores window.canton while controlled provider selection is empty", async () => {
    const selectedProvider = createMockProvider(({ method }) => {
      if (method === "status") {
        return {
          provider: { id: "selected" },
          connection: { isConnected: true, isNetworkConnected: true },
          network: { networkId: TEST_ACCOUNT.networkId },
        };
      }
      if (method === "listAccounts") {
        return [TEST_ACCOUNT];
      }
      throw new Error(`Unhandled method: ${method}`);
    });
    const windowProvider = createMockProvider(({ method }) => {
      if (method === "status") {
        return {
          provider: { id: "window" },
          connection: { isConnected: true, isNetworkConnected: true },
          network: { networkId: TEST_ACCOUNT.networkId },
        };
      }
      if (method === "listAccounts") {
        return [TEST_ACCOUNT];
      }
      throw new Error(`Unhandled method: ${method}`);
    });
    installMockProvider(windowProvider);

    const view = render(<ProviderHarness provider={null} />);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(view.getByLabelText("connection-status").textContent).toBe("not-ready:disconnected");
    expect(windowProvider.calls).toEqual([]);

    view.rerender(<ProviderHarness provider={selectedProvider} />);

    await waitFor(() => {
      expect(view.getByLabelText("connection-status").textContent).toBe("ready:connected");
    });

    expect(selectedProvider.calls.map(({ method }) => method)).toContain("status");
    expect(windowProvider.calls).toEqual([]);
  });

  test("does not reboot a connected provider when callback identity changes", async () => {
    const snapshots: string[] = [];
    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return {
          provider: { id: "stable" },
          connection: { isConnected: true, isNetworkConnected: true },
          network: { networkId: TEST_ACCOUNT.networkId },
        };
      }
      if (method === "listAccounts") {
        return [TEST_ACCOUNT];
      }
      throw new Error(`Unhandled method: ${method}`);
    });
    const onSnapshot = (value: CantonContextValue) => {
      snapshots.push(
        `${value.providerReady ? "ready" : "not-ready"}:${value.connectionState.status}`,
      );
    };

    const view = render(
      <ProviderHarness
        initGraceMs={0}
        onError={() => {}}
        onSnapshot={onSnapshot}
        provider={provider}
      />,
    );

    await waitFor(() => {
      expect(view.getByLabelText("connection-status").textContent).toBe("ready:connected");
    });
    const callsAfterConnect = provider.calls.length;
    snapshots.length = 0;

    view.rerender(
      <ProviderHarness
        initGraceMs={0}
        onError={() => {
          throw new Error("new callback identity should not be called");
        }}
        onSnapshot={onSnapshot}
        provider={provider}
      />,
    );

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(view.getByLabelText("connection-status").textContent).toBe("ready:connected");
    expect(provider.calls).toHaveLength(callsAfterConnect);
    expect(snapshots).not.toContain("not-ready:disconnected");
  });
});
