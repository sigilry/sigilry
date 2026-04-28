import { afterEach, describe, expect, test, vi } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { CantonReactProvider, useCanton } from "../src/context.js";
import type { Account, ConnectionState, ParsedError } from "../src/types.js";
import {
  act,
  CONNECTED_STATUS,
  DISCONNECTED_STATUS,
  TEST_ACCOUNT,
  createMockProvider,
  installMockProvider,
  registerTestIsolation,
  renderHook,
} from "./testUtils.js";

registerTestIsolation();

const EVENT_ACCOUNT: Account = {
  ...TEST_ACCOUNT,
  partyId: "event::1220",
  hint: "event",
  publicKey: "pk-event",
  signingProviderId: "sp-event",
};

const STATUS_ACCOUNT: Account = {
  ...TEST_ACCOUNT,
  partyId: "status::1220",
  hint: "status",
  publicKey: "pk-status",
  signingProviderId: "sp-status",
};

const EMITTED_RAW_ACCOUNT = {
  partyId: "emitted::1220",
  primary: true,
  networkId: "canton:testnet",
  publicKey: "pk-emitted",
  status: "initialized",
  signingProviderId: "sp-emitted",
  disabled: false,
  reason: "available",
};

const EMITTED_ACCOUNT: Account = {
  partyId: "emitted::1220",
  hint: "emitted",
  namespace: "1220",
  networkId: "canton:testnet",
  publicKey: "pk-emitted",
  primary: true,
  status: "initialized",
  signingProviderId: "sp-emitted",
  disabled: false,
  reason: "available",
};

const STATUS_SETTLE_TIMEOUT_MS = 5000;

type TestWrapperOptions = {
  initGraceMs?: number;
  onError?: (error: ParsedError) => void;
  onConnectionChange?: (state: ConnectionState) => void;
};

function createProviderWrapper(options: TestWrapperOptions = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  const Provider = CantonReactProvider as (
    props: PropsWithChildren<TestWrapperOptions>,
  ) => JSX.Element;

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>
        <Provider
          initGraceMs={options.initGraceMs}
          onError={options.onError}
          onConnectionChange={options.onConnectionChange}
        >
          {children}
        </Provider>
      </QueryClientProvider>
    );
  }

  return { Wrapper, queryClient };
}

async function advanceTimersByTimeAsync(ms: number): Promise<void> {
  vi.advanceTimersByTime(ms);
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
});

describe("CantonReactProvider initGraceMs", () => {
  test("waits through initGraceMs before consulting cold status when an event can still win", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(CONNECTED_STATUS), 50);
        });
      }

      if (method === "listAccounts") {
        return [STATUS_ACCOUNT];
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);
    setTimeout(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    }, 100);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(75);
    });

    expect(result.current.connectionState).toEqual({ status: "disconnected" });

    await act(async () => {
      await advanceTimersByTimeAsync(25);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
    expect(result.current.partyId).toBe(EVENT_ACCOUNT.partyId);
  });

  test("accountsChanged wins the grace-window race and cold status cannot roll state back", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(CONNECTED_STATUS), 300);
        });
      }

      if (method === "listAccounts") {
        return [STATUS_ACCOUNT];
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);
    setTimeout(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    }, 50);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(60);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
    expect(result.current.partyId).toBe(EVENT_ACCOUNT.partyId);

    await act(async () => {
      await advanceTimersByTimeAsync(300);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
  });

  test("synchronous accountsChanged emitted during listener install wins the bootstrap race", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(CONNECTED_STATUS), 50);
        });
      }

      if (method === "listAccounts") {
        return [STATUS_ACCOUNT];
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    const originalOn = provider.on.bind(provider);
    provider.on = (event, listener) => {
      originalOn(event, listener);
      if (event === "accountsChanged") {
        listener([EVENT_ACCOUNT]);
      }
    };

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });

    await act(async () => {
      await advanceTimersByTimeAsync(60);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
    expect(result.current.partyId).toBe(EVENT_ACCOUNT.partyId);
    expect(result.current.connectionState.status).toBe("connected");
    expect(result.current.connectionState.accounts).not.toContainEqual(STATUS_ACCOUNT);
  });

  test("captures synchronous accountsChanged emitted during the status bootstrap probe", async () => {
    vi.useFakeTimers();
    const states: ConnectionState["status"][] = [];

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        provider.emit("accountsChanged", [EMITTED_RAW_ACCOUNT]);
        return new Promise((resolve) => {
          setTimeout(() => resolve(DISCONNECTED_STATUS), 50);
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({
      initGraceMs: 150,
      onConnectionChange: (state) => {
        states.push(state.status);
      },
    });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(200);
    });

    expect(states).toEqual(["disconnected", "connected"]);
    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EMITTED_ACCOUNT],
      networkId: EMITTED_ACCOUNT.networkId,
    });
    expect(result.current.partyId).toBe(EMITTED_ACCOUNT.partyId);
  });

  test("discards late cold status after accountsChanged wins during an in-flight fallback", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(CONNECTED_STATUS), 300);
        });
      }

      if (method === "listAccounts") {
        return [STATUS_ACCOUNT];
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);
    setTimeout(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    }, 200);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(200);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
    expect(result.current.partyId).toBe(EVENT_ACCOUNT.partyId);

    await act(async () => {
      await advanceTimersByTimeAsync(150);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
    expect(result.current.partyId).toBe(EVENT_ACCOUNT.partyId);
  });

  test("late accountsChanged during in-flight restoreFromStatus wins over stale cold accounts", async () => {
    vi.useFakeTimers();
    const states: ConnectionState["status"][] = [];
    let resolveListAccounts: (accounts: Account[]) => void = () => {
      throw new Error("listAccounts was not requested");
    };

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(CONNECTED_STATUS), 25);
        });
      }

      if (method === "listAccounts") {
        return new Promise<Account[]>((resolve) => {
          resolveListAccounts = resolve;
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({
      initGraceMs: 150,
      onConnectionChange: (state) => {
        states.push(state.status);
      },
    });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(150);
    });

    act(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    });

    await act(async () => {
      resolveListAccounts([STATUS_ACCOUNT]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
    expect(result.current.partyId).toBe(EVENT_ACCOUNT.partyId);
    expect(states).toEqual(["disconnected", "connected"]);
  });

  test("stale listAccounts SESSION_EXPIRED after accountsChanged wins does not roll state back", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const sessionExpiredError = new Error("Session expired while listing accounts");
    let rejectListAccounts: (error: Error) => void = () => {
      throw new Error("listAccounts was not requested");
    };

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(CONNECTED_STATUS), 25);
        });
      }

      if (method === "listAccounts") {
        return new Promise<Account[]>((_, reject) => {
          rejectListAccounts = reject;
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150, onError });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(150);
    });

    expect(provider.calls.map((call) => call.method)).toEqual(["status", "listAccounts"]);

    act(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });

    await act(async () => {
      rejectListAccounts(sessionExpiredError);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({
      message: "Your session has expired",
      code: "SESSION_EXPIRED",
      action: { type: "reconnect" },
      raw: sessionExpiredError,
    });
  });

  test("late status SESSION_EXPIRED rejection after accountsChanged wins does not roll state back", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const sessionExpiredError = new Error("Session expired while checking status");
    let rejectStatus: (error: Error) => void = () => {
      throw new Error("status was not requested");
    };

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((_, reject) => {
          rejectStatus = reject;
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150, onError });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    expect(provider.calls.map((call) => call.method)).toEqual(["status"]);

    act(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });

    await act(async () => {
      // Let the event-won branch observe the bootstrap signal before rejecting the losing
      // status request, matching the late async rejection that previously cleared the guard.
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      rejectStatus(sessionExpiredError);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({
      message: "Your session has expired",
      code: "SESSION_EXPIRED",
      action: { type: "reconnect" },
      raw: sessionExpiredError,
    });
  });

  test("user-initiated SESSION_EXPIRED during bootstrap window does roll state back", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    const sessionExpiredError = new Error("Session expired during user request");

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise(() => {});
      }

      if (method === "listAccounts") {
        throw sessionExpiredError;
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150, onError });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    expect(provider.calls.map((call) => call.method)).toEqual(["status"]);

    act(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });

    await act(async () => {
      // Keep the event-won bootstrap branch inside its bounded status settle wait.
      await Promise.resolve();
      await Promise.resolve();
    });

    let requestError: unknown;
    await act(async () => {
      try {
        await result.current.request("listAccounts");
      } catch (err) {
        requestError = err;
      }
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestError).toBe(sessionExpiredError);
    expect(result.current.connectionState).toEqual({
      status: "session_expired",
      lastAccounts: [EVENT_ACCOUNT],
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({
      message: "Your session has expired",
      code: "SESSION_EXPIRED",
      action: { type: "reconnect" },
      raw: sessionExpiredError,
    });
  });

  test("hung status() after accountsChanged wins does not suppress later session errors", async () => {
    vi.useFakeTimers();
    const sessionExpiredError = new Error("Session expired after bootstrap completed");

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise(() => {});
      }

      if (method === "listAccounts") {
        throw sessionExpiredError;
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    expect(provider.calls.map((call) => call.method)).toEqual(["status"]);

    act(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });

    await act(async () => {
      // Let the event-won branch install its bounded wait before advancing fake time.
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      await advanceTimersByTimeAsync(STATUS_SETTLE_TIMEOUT_MS + 100);
    });

    let requestError: unknown;
    await act(async () => {
      try {
        await result.current.request("listAccounts");
      } catch (err) {
        requestError = err;
      }
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestError).toBe(sessionExpiredError);
    expect(result.current.connectionState).toEqual({
      status: "session_expired",
      lastAccounts: [EVENT_ACCOUNT],
    });
  });

  test("hung status() on non-winner fallback does not suppress later session errors", async () => {
    vi.useFakeTimers();
    const sessionExpiredError = new Error("Session expired after fallback timeout");

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise(() => {});
      }

      if (method === "listAccounts") {
        throw sessionExpiredError;
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(150);
    });

    expect(provider.calls.map((call) => call.method)).toEqual(["status"]);
    expect(result.current.connectionState).toEqual({ status: "disconnected" });

    await act(async () => {
      // Let the non-winner fallback hit its bounded status wait before a later event arrives.
      await advanceTimersByTimeAsync(STATUS_SETTLE_TIMEOUT_MS + 100);
    });

    act(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });

    let requestError: unknown;
    await act(async () => {
      try {
        await result.current.request("listAccounts");
      } catch (err) {
        requestError = err;
      }
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(requestError).toBe(sessionExpiredError);
    expect(result.current.connectionState).toEqual({
      status: "session_expired",
      lastAccounts: [EVENT_ACCOUNT],
    });
  });

  test("late SESSION_EXPIRED rejection on abandoned bootstrap status does not roll back a later event connection", async () => {
    vi.useFakeTimers();
    const sessionExpiredError = new Error("Session expired after abandoned bootstrap status");
    let rejectStatus: (error: Error) => void = () => {
      throw new Error("status was not requested");
    };

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((_, reject) => {
          rejectStatus = reject;
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(150);
    });

    expect(provider.calls.map((call) => call.method)).toEqual(["status"]);
    expect(result.current.connectionState).toEqual({ status: "disconnected" });

    await act(async () => {
      await advanceTimersByTimeAsync(STATUS_SETTLE_TIMEOUT_MS + 100);
    });

    expect(result.current.connectionState).toEqual({ status: "disconnected" });

    act(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });

    await act(async () => {
      rejectStatus(sessionExpiredError);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionState.status).toBe("connected");
    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
  });

  test("malformed accountsChanged during grace window calls onError exactly once", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise(() => {});
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150, onError });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    await act(async () => {
      provider.emit("accountsChanged", [null]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(result.current.connectionState).toEqual({ status: "disconnected" });
  });

  test("malformed accountsChanged during grace window still uses cold status fallback", async () => {
    vi.useFakeTimers();
    const onError = vi.fn();
    let resolveStatus: (status: typeof CONNECTED_STATUS) => void = () => {
      throw new Error("status was not requested");
    };

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise<typeof CONNECTED_STATUS>((resolve) => {
          resolveStatus = resolve;
        });
      }

      if (method === "listAccounts") {
        return [STATUS_ACCOUNT];
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150, onError });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    await act(async () => {
      provider.emit("accountsChanged", [null]);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onError).toHaveBeenCalled();
    expect(result.current.connectionState).toEqual({ status: "disconnected" });

    await act(async () => {
      resolveStatus(CONNECTED_STATUS);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [STATUS_ACCOUNT],
      networkId: CONNECTED_STATUS.network.networkId,
    });
    expect(result.current.partyId).toBe(STATUS_ACCOUNT.partyId);
  });

  test("falls back to cold status after the grace window expires without an event", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(CONNECTED_STATUS), 250);
        });
      }

      if (method === "listAccounts") {
        return [STATUS_ACCOUNT];
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(300);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [STATUS_ACCOUNT],
      networkId: CONNECTED_STATUS.network.networkId,
    });
    expect(result.current.partyId).toBe(STATUS_ACCOUNT.partyId);
  });

  test("initGraceMs=0 skips the bootstrap race listener and keeps the legacy cold-status path", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(CONNECTED_STATUS), 200);
        });
      }

      if (method === "listAccounts") {
        return [STATUS_ACCOUNT];
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    const onSpy = vi.spyOn(provider, "on");
    installMockProvider(provider);
    setTimeout(() => {
      provider.emit("accountsChanged", [EVENT_ACCOUNT]);
    }, 10);

    const { Wrapper, queryClient } = createProviderWrapper({ initGraceMs: 0 });
    const { result, unmount } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(20);
    });

    const zeroGraceBootstrapListeners = onSpy.mock.calls.filter(
      ([event, handler]) =>
        event === "accountsChanged" &&
        typeof handler === "function" &&
        handler.name === "handleBootstrapAccountsChanged",
    );

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });
    expect(zeroGraceBootstrapListeners).toHaveLength(0);

    await act(async () => {
      await advanceTimersByTimeAsync(220);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [STATUS_ACCOUNT],
      networkId: CONNECTED_STATUS.network.networkId,
    });

    unmount();
    queryClient.clear();
    vi.clearAllMocks();
    vi.clearAllTimers();
    delete (window as Window & { canton?: typeof provider }).canton;

    const graceProvider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(CONNECTED_STATUS), 200);
        });
      }

      if (method === "listAccounts") {
        return [STATUS_ACCOUNT];
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    const graceOnSpy = vi.spyOn(graceProvider, "on");
    installMockProvider(graceProvider);

    const { Wrapper: graceWrapper, queryClient: graceQueryClient } = createProviderWrapper({
      initGraceMs: 150,
    });
    const { unmount: unmountGrace } = renderHook(() => useCanton(), { wrapper: graceWrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(20);
    });

    const graceBootstrapListeners = graceOnSpy.mock.calls.filter(
      ([event, handler]) =>
        event === "accountsChanged" &&
        typeof handler === "function" &&
        handler.name === "handleBootstrapAccountsChanged",
    );

    expect(graceBootstrapListeners).toHaveLength(1);

    unmountGrace();
    graceQueryClient.clear();
    vi.clearAllMocks();
    vi.clearAllTimers();
    delete (window as Window & { canton?: typeof graceProvider }).canton;
  });

  test("stays disconnected when neither the grace event nor cold status reports a connection", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(DISCONNECTED_STATUS), 200);
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(250);
    });

    expect(result.current.connectionState).toEqual({ status: "disconnected" });
  });

  test("stays in the initial state when neither an event nor a cold status result arrives within grace", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise(() => {});
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(250);
    });

    expect(result.current.connectionState).toEqual({ status: "disconnected" });
  });

  test("onConnectionChange emits one connected transition for both event and status race winners", async () => {
    vi.useFakeTimers();

    for (const winner of ["event", "status"] as const) {
      const states: ConnectionState["status"][] = [];
      const provider = createMockProvider(({ method }) => {
        if (method === "status") {
          return new Promise((resolve) => {
            setTimeout(() => resolve(CONNECTED_STATUS), winner === "event" ? 300 : 50);
          });
        }

        if (method === "listAccounts") {
          return [STATUS_ACCOUNT];
        }

        throw new Error(`Unhandled method: ${method}`);
      });

      installMockProvider(provider);
      if (winner === "event") {
        setTimeout(() => {
          provider.emit("accountsChanged", [EVENT_ACCOUNT]);
        }, 50);
      }

      const { Wrapper, queryClient } = createProviderWrapper({
        initGraceMs: 150,
        onConnectionChange: (state) => {
          states.push(state.status);
        },
      });

      renderHook(() => useCanton(), { wrapper: Wrapper });

      await act(async () => {
        await advanceTimersByTimeAsync(350);
      });

      expect(states).toEqual(["disconnected", "connected"]);
      queryClient.clear();
      delete (window as Window & { canton?: typeof provider }).canton;
      vi.clearAllMocks();
      vi.clearAllTimers();
    }
  });

  test("onAccountsChanged notifies a single handler with parsed accounts", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(DISCONNECTED_STATUS), 200);
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });
    const handler = vi.fn();

    act(() => {
      result.current.onAccountsChanged(handler);
    });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    act(() => {
      provider.emit("accountsChanged", [EMITTED_RAW_ACCOUNT]);
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith([EMITTED_ACCOUNT]);
    expect(handler.mock.calls[0]?.[0]?.[0]).toMatchObject({
      partyId: EMITTED_ACCOUNT.partyId,
      primary: EMITTED_ACCOUNT.primary,
      networkId: EMITTED_ACCOUNT.networkId,
      status: EMITTED_ACCOUNT.status,
    });

    await act(async () => {
      await advanceTimersByTimeAsync(200);
    });
  });

  test("wallet payload with unknown field is parsed without throwing", async () => {
    vi.useFakeTimers();

    const onError = vi.fn();
    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(DISCONNECTED_STATUS), 200);
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150, onError });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    expect(() => {
      act(() => {
        provider.emit("accountsChanged", [
          { ...EVENT_ACCOUNT, debugSentinel: "xyz", _provider: "ext-1.5" },
        ]);
      });
    }).not.toThrow();

    expect(onError).not.toHaveBeenCalled();
    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EVENT_ACCOUNT],
      networkId: EVENT_ACCOUNT.networkId,
    });

    if (result.current.connectionState.status !== "connected") {
      throw new Error("expected accountsChanged to connect the provider");
    }

    const [account] = result.current.connectionState.accounts;
    expect(account).toEqual(EVENT_ACCOUNT);
    expect(account && "debugSentinel" in account).toBe(false);
    expect(account && "_provider" in account).toBe(false);

    await act(async () => {
      await advanceTimersByTimeAsync(200);
    });
  });

  test("onAccountsChanged notifies every subscribed handler", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(DISCONNECTED_STATUS), 200);
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });
    const handlerOne = vi.fn();
    const handlerTwo = vi.fn();
    const handlerThree = vi.fn();

    act(() => {
      result.current.onAccountsChanged(handlerOne);
      result.current.onAccountsChanged(handlerTwo);
      result.current.onAccountsChanged(handlerThree);
    });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    act(() => {
      provider.emit("accountsChanged", [EMITTED_RAW_ACCOUNT]);
    });

    expect(handlerOne).toHaveBeenCalledTimes(1);
    expect(handlerTwo).toHaveBeenCalledTimes(1);
    expect(handlerThree).toHaveBeenCalledTimes(1);
    expect(handlerOne).toHaveBeenCalledWith([EMITTED_ACCOUNT]);
    expect(handlerTwo).toHaveBeenCalledWith([EMITTED_ACCOUNT]);
    expect(handlerThree).toHaveBeenCalledWith([EMITTED_ACCOUNT]);

    await act(async () => {
      await advanceTimersByTimeAsync(200);
    });
  });

  test("onAccountsChanged isolates handler failures and still updates state", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(DISCONNECTED_STATUS), 200);
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const warnings: unknown[][] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args);
    };

    try {
      const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
      const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });
      const handlerError = new Error("boom");
      const throwingHandler = vi.fn(() => {
        throw handlerError;
      });
      const survivingHandler = vi.fn();

      act(() => {
        result.current.onAccountsChanged(throwingHandler);
        result.current.onAccountsChanged(survivingHandler);
      });

      await act(async () => {
        await advanceTimersByTimeAsync(50);
      });

      expect(() => {
        act(() => {
          provider.emit("accountsChanged", [EMITTED_RAW_ACCOUNT]);
        });
      }).not.toThrow();

      expect(throwingHandler).toHaveBeenCalledTimes(1);
      expect(throwingHandler).toHaveBeenCalledWith([EMITTED_ACCOUNT]);
      expect(survivingHandler).toHaveBeenCalledTimes(1);
      expect(survivingHandler).toHaveBeenCalledWith([EMITTED_ACCOUNT]);
      expect(result.current.connectionState).toEqual({
        status: "connected",
        accounts: [EMITTED_ACCOUNT],
        networkId: EMITTED_ACCOUNT.networkId,
      });
      expect(warnings).toHaveLength(1);
      expect(warnings[0]?.[0]).toBe("[sigilry] onAccountsChanged handler threw");
      expect(warnings[0]?.[1]).toBe(handlerError);

      await act(async () => {
        await advanceTimersByTimeAsync(200);
      });
    } finally {
      console.warn = originalWarn;
    }
  });

  test("onAccountsChanged receives [] for session-expired payloads while state still mutates", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(DISCONNECTED_STATUS), 200);
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });
    const handler = vi.fn();

    act(() => {
      result.current.onAccountsChanged(handler);
    });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    act(() => {
      provider.emit("accountsChanged", []);
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith([]);
    expect(result.current.connectionState).toEqual({
      status: "session_expired",
      lastAccounts: undefined,
    });

    await act(async () => {
      await advanceTimersByTimeAsync(200);
    });
  });

  test("onAccountsChanged unsubscribe removes only the matching handler", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(DISCONNECTED_STATUS), 200);
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });
    const removedHandler = vi.fn();
    const activeHandler = vi.fn();
    let unsubscribe = () => {};

    act(() => {
      unsubscribe = result.current.onAccountsChanged(removedHandler);
      result.current.onAccountsChanged(activeHandler);
    });

    act(() => {
      unsubscribe();
    });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    act(() => {
      provider.emit("accountsChanged", [EMITTED_RAW_ACCOUNT]);
    });

    expect(removedHandler).not.toHaveBeenCalled();
    expect(activeHandler).toHaveBeenCalledTimes(1);
    expect(activeHandler).toHaveBeenCalledWith([EMITTED_ACCOUNT]);

    await act(async () => {
      await advanceTimersByTimeAsync(200);
    });
  });

  test("accountsChanged still mutates state when no handlers are subscribed", async () => {
    vi.useFakeTimers();

    const provider = createMockProvider(({ method }) => {
      if (method === "status") {
        return new Promise((resolve) => {
          setTimeout(() => resolve(DISCONNECTED_STATUS), 200);
        });
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createProviderWrapper({ initGraceMs: 150 });
    const { result } = renderHook(() => useCanton(), { wrapper: Wrapper });

    await act(async () => {
      await advanceTimersByTimeAsync(50);
    });

    act(() => {
      provider.emit("accountsChanged", [EMITTED_RAW_ACCOUNT]);
    });

    expect(result.current.connectionState).toEqual({
      status: "connected",
      accounts: [EMITTED_ACCOUNT],
      networkId: EMITTED_ACCOUNT.networkId,
    });

    await act(async () => {
      await advanceTimersByTimeAsync(200);
    });
  });
});
