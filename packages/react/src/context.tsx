/**
 * CantonContext - React context for Canton provider state
 *
 * Provides connection state and actions to all child components.
 */

import type React from "react";
import { WalletSchema } from "@sigilry/dapp/schemas";
import type { RpcMethods } from "@sigilry/dapp/schemas";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Account, CantonProvider, ConnectionState, ParsedError, TxEvent } from "./types";
import { parseError, parsePartyId } from "./types";

type RpcMethodName = keyof RpcMethods;
type RpcParams<M extends RpcMethodName> = RpcMethods[M]["params"];
type RpcResult<M extends RpcMethodName> = RpcMethods[M]["result"];
type OptionalParams<M extends RpcMethodName> = RpcParams<M> extends void ? [] : [RpcParams<M>];
type RpcRequestFn = <M extends RpcMethodName>(
  method: M,
  ...params: OptionalParams<M>
) => Promise<RpcResult<M>>;
type BootstrapInitResult = { source: "event"; rawAccounts: unknown[] } | { source: "timeout" };
type ConnectResultWithAccounts = RpcResult<"connect"> & { accounts?: unknown };

const DEFAULT_INIT_GRACE_MS = 150;
const DEFAULT_NETWORK_ID = "canton:localnet";
const STATUS_SETTLE_TIMEOUT_MS = 5000;
const STATUS_TIMEOUT_SENTINEL = Symbol("statusSettleTimeout");

/**
 * Transform raw wallet data from listAccounts into Account type
 */
function toAccount(wallet: Record<string, unknown>): Account {
  const partyId = String(wallet.partyId ?? "");
  const { hint, namespace } = parsePartyId(partyId);
  return WalletSchema.parse({
    primary: wallet.primary,
    partyId,
    status: wallet.status ?? "allocated",
    hint: typeof wallet.hint === "string" ? wallet.hint : hint,
    publicKey: wallet.publicKey,
    namespace: typeof wallet.namespace === "string" ? wallet.namespace : namespace,
    networkId: wallet.networkId,
    signingProviderId: wallet.signingProviderId,
    externalTxId: wallet.externalTxId,
    topologyTransactions: wallet.topologyTransactions,
    disabled: wallet.disabled,
    reason: wallet.reason,
  });
}

function parseAccounts(rawAccounts: unknown[]): Account[] {
  return rawAccounts.map((wallet, index) => {
    if (typeof wallet !== "object" || wallet === null) {
      throw new Error(`Wallet payload at index ${index} is not an object`);
    }

    return toAccount(wallet as Record<string, unknown>);
  });
}

function notifyAccountsChangedHandlers(
  handlers: ReadonlySet<(accounts: Account[]) => void>,
  accounts: Account[],
): void {
  for (const handler of handlers) {
    try {
      handler(accounts);
    } catch (error) {
      // Consumer callbacks are advisory. One bad handler must not block later handlers or the
      // provider's own state transition for the same accountsChanged event.
      // oxlint-disable-next-line no-console -- REQ-REACT-CSTATE-008 requires visible warnings without breaking delivery or state mutation.
      console.warn("[sigilry] onAccountsChanged handler threw", error);
    }
  }
}

function accountsEqual(left: Account[], right: Account[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((account, index) => {
    const next = right[index];
    return (
      account.partyId === next?.partyId &&
      account.hint === next?.hint &&
      account.namespace === next?.namespace &&
      account.networkId === next?.networkId &&
      account.publicKey === next?.publicKey &&
      account.primary === next?.primary &&
      account.status === next?.status &&
      account.signingProviderId === next?.signingProviderId &&
      account.externalTxId === next?.externalTxId &&
      account.topologyTransactions === next?.topologyTransactions &&
      account.disabled === next?.disabled &&
      account.reason === next?.reason
    );
  });
}

function isParsedError(error: unknown): error is ParsedError {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as Partial<ParsedError>;
  return typeof candidate.message === "string" && typeof candidate.action === "object";
}

export interface CantonContextValue {
  // Connection state (discriminated union)
  connectionState: ConnectionState;
  // Derived convenience values
  isConnected: boolean;
  isConnecting: boolean;
  accounts: Account[];
  activeAccount: Account | null;
  partyId: string | null;
  networkId: string | null;
  providerReady: boolean;
  // Actions
  connect: () => Promise<RpcResult<"connect">>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  setActiveAccount: (partyId: string) => void;
  // RPC helper
  request: <M extends RpcMethodName>(
    method: M,
    ...params: OptionalParams<M>
  ) => Promise<RpcResult<M>>;
  // Event subscription
  onAccountsChanged: (handler: (accounts: Account[]) => void) => () => void;
  onTxChanged: (handler: (event: TxEvent) => void) => () => void;
}

const CantonContext = createContext<CantonContextValue | null>(null);

export interface CantonProviderProps {
  children: ReactNode;
  /** Called when an error occurs */
  onError?: (error: ParsedError) => void;
  /** Called on connection state changes */
  onConnectionChange?: (state: ConnectionState) => void;
  /** Grace window for event-first bootstrap before falling back to cold status */
  initGraceMs?: number;
}

type CantonWindow = Window & {
  canton?: CantonProvider;
};

export function CantonReactProvider({
  children,
  onError,
  onConnectionChange,
  initGraceMs = DEFAULT_INIT_GRACE_MS,
}: CantonProviderProps): React.ReactNode {
  // Core connection state using discriminated union
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "disconnected",
  });
  const [providerReady, setProviderReady] = useState(false);
  const [activePartyId, setActivePartyId] = useState<string | null>(null);

  const initializedRef = useRef(false);
  const bootstrapEventTrackingRef = useRef(false);
  const bootstrapEventWonRef = useRef(false);
  const providerAccountsSubscriptionRef = useRef<CantonProvider | null>(null);
  const latestAccountsChangedHandlerRef = useRef<(rawAccounts: unknown[]) => void>(() => {});
  // Keep account-stream subscribers on a stable ref so the provider listener can stay long-lived.
  const accountsHandlersRef = useRef<Set<(accounts: Account[]) => void>>(new Set());
  const txHandlersRef = useRef<Set<(event: TxEvent) => void>>(new Set());

  // Derived values from connection state
  const isConnected = connectionState.status === "connected";
  const isConnecting = connectionState.status === "connecting";
  const accounts = connectionState.status === "connected" ? connectionState.accounts : [];
  const networkId = connectionState.status === "connected" ? connectionState.networkId : null;
  const activeAccount = accounts.find((a) => a.partyId === activePartyId) ?? accounts[0] ?? null;
  const partyId = activeAccount?.partyId ?? null;

  // Notify on connection state changes
  useEffect(() => {
    onConnectionChange?.(connectionState);
  }, [connectionState, onConnectionChange]);

  // Get the provider from window
  const getProvider = useCallback((): CantonProvider | null => {
    return (window as CantonWindow).canton ?? null;
  }, []);

  // RPC call helper with error parsing
  const request = useCallback(
    async <M extends RpcMethodName>(
      method: M,
      ...params: OptionalParams<M>
    ): Promise<RpcResult<M>> => {
      const canton = getProvider();
      if (!canton) throw new Error("Provider not available");

      try {
        const rpcParams = params[0] as RpcParams<M> | undefined;
        const result = await canton.request({ method, params: rpcParams });
        return result as RpcResult<M>;
      } catch (err) {
        const parsed = parseError(err);
        onError?.(parsed);
        const sessionError =
          parsed.code === "SESSION_EXPIRED" ||
          parsed.code === "TOKEN_REFRESH_REQUIRED" ||
          parsed.code === "NOT_CONNECTED";

        // Update connection state on session errors
        if (sessionError) {
          setConnectionState((prev) => {
            const lastAccounts = prev.status === "connected" ? prev.accounts : undefined;
            return { status: "session_expired", lastAccounts };
          });
        }

        throw err;
      }
    },
    [getProvider, onError],
  );

  const bootstrapRequest = useCallback(
    async <M extends RpcMethodName>(
      method: M,
      ...params: OptionalParams<M>
    ): Promise<RpcResult<M>> => {
      const canton = getProvider();
      if (!canton) throw new Error("Provider not available");

      const rpcParams = params[0] as RpcParams<M> | undefined;
      const result = await canton.request({ method, params: rpcParams });
      return result as RpcResult<M>;
    },
    [getProvider],
  );

  // Fetch accounts and update state
  const fetchAccounts = useCallback(
    async (rpc: RpcRequestFn = request): Promise<Account[]> => {
      const result = await rpc("listAccounts");
      if (!Array.isArray(result)) {
        throw new Error("listAccounts returned a non-array payload");
      }

      return parseAccounts(result);
    },
    [request],
  );

  // During bootstrap, any parsed accountsChanged push that lands before the cold status path
  // settles becomes authoritative and prevents fallback restore from overwriting newer state.
  const markBootstrapEventWin = useCallback(() => {
    if (!bootstrapEventTrackingRef.current) {
      return;
    }

    bootstrapEventWonRef.current = true;
  }, []);

  // Promote an accountsChanged payload while preserving the existing connected network when present.
  const promoteAccountsChanged = useCallback(
    (newAccounts: Account[]) => {
      markBootstrapEventWin();

      if (newAccounts.length === 0) {
        setConnectionState((prev) => {
          const lastAccounts = prev.status === "connected" ? prev.accounts : undefined;
          return { status: "session_expired", lastAccounts };
        });
        return;
      }

      const primaryAccount =
        newAccounts.find((account) => account.primary) ?? newAccounts[0] ?? null;

      setConnectionState((prev) => {
        const nextNetworkId =
          prev.status === "connected"
            ? prev.networkId
            : (primaryAccount?.networkId ?? DEFAULT_NETWORK_ID);

        if (
          prev.status === "connected" &&
          prev.networkId === nextNetworkId &&
          accountsEqual(prev.accounts, newAccounts)
        ) {
          return prev;
        }

        return {
          status: "connected",
          accounts: newAccounts,
          networkId: nextNetworkId,
        };
      });

      setActivePartyId((prev) => prev ?? primaryAccount?.partyId ?? null);
    },
    [markBootstrapEventWin],
  );

  // Restore connected state from a status() response using the existing listAccounts shape.
  const restoreFromStatus = useCallback(
    async (statusResult: RpcResult<"status">, rpc: RpcRequestFn = request) => {
      const connection =
        "connection" in statusResult && typeof statusResult.connection === "object"
          ? statusResult.connection
          : undefined;

      if (!connection) {
        // eslint-disable-next-line no-console -- REQ-REACT-CSTATE-006 preserves this legacy-shape warning.
        console.warn("[sigilry] StatusEvent.connection missing; provider may be on legacy shape");
        return;
      }

      if (!connection.isConnected) {
        return;
      }

      const restoredAccounts = await fetchAccounts(rpc);
      if (bootstrapEventWonRef.current) {
        // An accountsChanged push can arrive while listAccounts is in flight and must remain authoritative.
        return;
      }

      if (restoredAccounts.length === 0) {
        return;
      }

      const primaryAccount =
        restoredAccounts.find((account) => account.primary) ?? restoredAccounts[0] ?? null;
      const nextNetworkId =
        statusResult.network?.networkId ?? primaryAccount?.networkId ?? DEFAULT_NETWORK_ID;

      setConnectionState((prev) => {
        if (
          prev.status === "connected" &&
          prev.networkId === nextNetworkId &&
          accountsEqual(prev.accounts, restoredAccounts)
        ) {
          return prev;
        }

        return {
          status: "connected",
          accounts: restoredAccounts,
          networkId: nextNetworkId,
        };
      });
      setActivePartyId((prev) => prev ?? primaryAccount?.partyId ?? null);
    },
    [fetchAccounts, request],
  );

  const handleAccountsChanged = useCallback(
    (rawAccounts: unknown[]) => {
      let accountsForHandlers: Account[] = [];

      try {
        accountsForHandlers =
          !rawAccounts || rawAccounts.length === 0 ? [] : parseAccounts(rawAccounts);
      } catch (err) {
        onError?.(parseError(err));
        return;
      }

      notifyAccountsChangedHandlers(accountsHandlersRef.current, accountsForHandlers);
      promoteAccountsChanged(accountsForHandlers);
    },
    [onError, promoteAccountsChanged],
  );

  useEffect(() => {
    latestAccountsChangedHandlerRef.current = handleAccountsChanged;
  }, [handleAccountsChanged]);

  const dispatchAccountsChanged = useCallback((rawAccounts: unknown[]) => {
    latestAccountsChangedHandlerRef.current(rawAccounts);
  }, []);

  // Race a one-shot bootstrap event against the in-flight cold status request.
  const waitForBootstrapSignal = useCallback(
    (canton: CantonProvider, graceWindowMs: number): Promise<BootstrapInitResult> => {
      return new Promise((resolve) => {
        let settled = false;
        const off = canton.off ?? canton.removeListener;
        const cleanup = () => {
          if (typeof off === "function") {
            off.call(
              canton,
              "accountsChanged",
              handleBootstrapAccountsChanged as (...args: unknown[]) => void,
            );
          }
          clearTimeout(timeoutId);
        };
        const settle = (result: BootstrapInitResult) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(result);
        };
        const handleBootstrapAccountsChanged = (rawAccounts: unknown[]) => {
          settle({ source: "event", rawAccounts });
        };
        const timeoutId = setTimeout(() => {
          settle({ source: "timeout" });
        }, graceWindowMs);

        canton.on(
          "accountsChanged",
          handleBootstrapAccountsChanged as (...args: unknown[]) => void,
        );
      });
    },
    [],
  );

  useEffect(() => {
    return () => {
      const provider = providerAccountsSubscriptionRef.current;
      if (!provider) {
        return;
      }

      const off = provider.off ?? provider.removeListener;
      if (typeof off === "function") {
        off.call(
          provider,
          "accountsChanged",
          dispatchAccountsChanged as (...args: unknown[]) => void,
        );
      }
      providerAccountsSubscriptionRef.current = null;
    };
  }, [dispatchAccountsChanged]);

  // Connect action
  const connect = useCallback(async () => {
    setConnectionState({ status: "connecting" });

    try {
      const connectResult = (await request("connect")) as ConnectResultWithAccounts;
      if (connectResult.isConnected) {
        const fetchedAccounts = Array.isArray(connectResult.accounts)
          ? parseAccounts(connectResult.accounts)
          : await fetchAccounts();
        const primaryAccount =
          fetchedAccounts.find((account) => account.primary) ?? fetchedAccounts[0] ?? null;

        if (primaryAccount) {
          setConnectionState({
            status: "connected",
            accounts: fetchedAccounts,
            networkId: primaryAccount.networkId ?? DEFAULT_NETWORK_ID,
          });
          setActivePartyId(primaryAccount.partyId);
          return connectResult;
        } else {
          setConnectionState({
            status: "error",
            error: {
              message: "Connected but no accounts available",
              code: "NOT_CONNECTED",
              action: { type: "reconnect" },
            },
          });
          return connectResult;
        }
      } else {
        const reason = connectResult.reason ?? "Wallet refused connection";
        const error: ParsedError = {
          message: reason,
          code: "NOT_CONNECTED",
          action: { type: "retry" },
        };
        setConnectionState({
          status: "error",
          error,
        });
        onError?.(error);
        throw error;
      }
    } catch (err) {
      if (isParsedError(err)) {
        throw err;
      }

      const parsed = parseError(err);
      setConnectionState({ status: "error", error: parsed });
      onError?.(parsed);
      throw parsed;
    }
  }, [request, fetchAccounts, onError]);

  // Disconnect action
  const disconnect = useCallback(async () => {
    try {
      await request("disconnect");
    } catch {
      // Ignore disconnect errors
    }
    setConnectionState({ status: "disconnected" });
    setActivePartyId(null);
  }, [request]);

  // Reconnect action
  const reconnect = useCallback(async () => {
    await connect();
  }, [connect]);

  // Set active account
  const setActiveAccount = useCallback((newPartyId: string) => {
    setActivePartyId(newPartyId);
  }, []);

  // Subscribe to accountsChanged events
  const onAccountsChanged = useCallback((handler: (accounts: Account[]) => void): (() => void) => {
    accountsHandlersRef.current.add(handler);
    return () => {
      accountsHandlersRef.current.delete(handler);
    };
  }, []);

  // Subscribe to txChanged events
  const onTxChanged = useCallback((handler: (event: TxEvent) => void): (() => void) => {
    txHandlersRef.current.add(handler);
    return () => {
      txHandlersRef.current.delete(handler);
    };
  }, []);

  // Initialize provider detection and session restore
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      // Wait for provider injection
      let attempts = 0;
      while (!getProvider() && attempts < 100) {
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }

      const canton = getProvider();
      if (!canton) {
        setConnectionState({
          status: "error",
          error: {
            message: "Extension not found. Is Send Wallet installed?",
            code: "NOT_CONNECTED",
            action: { type: "none" },
          },
        });
        return;
      }

      try {
        bootstrapEventWonRef.current = false;
        bootstrapEventTrackingRef.current = initGraceMs > 0;

        // Install the long-lived accountsChanged listener after arming bootstrap tracking so any
        // synchronous bootstrap announcement reaches subscribers and wins the grace race.
        canton.on("accountsChanged", dispatchAccountsChanged as (...args: unknown[]) => void);
        providerAccountsSubscriptionRef.current = canton;
        setProviderReady(true);

        const statusPromise = bootstrapRequest("status");
        // Event-first bootstrap can drop the cold status result on purpose, so keep rejections handled.
        void statusPromise.catch(() => {});

        if (initGraceMs <= 0) {
          await restoreFromStatus(await statusPromise, bootstrapRequest);
          return;
        }

        const bootstrapResult = await waitForBootstrapSignal(canton, initGraceMs);

        if (bootstrapResult.source === "event") {
          // Only a parsed accountsChanged payload is an event winner. Bound the wait for the
          // losing status request so a hung provider cannot delay bootstrap completion forever.
          if (bootstrapEventWonRef.current) {
            let statusSettleTimedOut = false;
            await Promise.race([
              statusPromise.catch((err: unknown) => {
                if (!statusSettleTimedOut) {
                  throw err;
                }
              }),
              new Promise<void>((resolve) => {
                setTimeout(() => {
                  statusSettleTimedOut = true;
                  resolve();
                }, STATUS_SETTLE_TIMEOUT_MS);
              }),
            ]);
            return;
          }
          // The long-lived listener already reported malformed event payloads. They are not
          // usable bootstrap signals, so continue to the cold status fallback below.
        }

        const statusResult = await Promise.race<
          RpcResult<"status"> | typeof STATUS_TIMEOUT_SENTINEL
        >([
          statusPromise,
          new Promise<typeof STATUS_TIMEOUT_SENTINEL>((resolve) => {
            setTimeout(() => resolve(STATUS_TIMEOUT_SENTINEL), STATUS_SETTLE_TIMEOUT_MS);
          }),
        ]);
        if (statusResult === STATUS_TIMEOUT_SENTINEL) {
          // A silent provider is treated like no bootstrap signal.
          return;
        }
        if (bootstrapEventWonRef.current) {
          return;
        }

        await restoreFromStatus(statusResult, bootstrapRequest);
      } catch (err) {
        const parsed = parseError(err);
        // Init-time failure should be visible to callers, but the provider may still recover on
        // a later explicit connect() attempt, so keep the existing connection state.
        onError?.(parsed);
      } finally {
        bootstrapEventTrackingRef.current = false;
      }
    };

    init();
  }, [
    bootstrapRequest,
    dispatchAccountsChanged,
    getProvider,
    initGraceMs,
    onError,
    restoreFromStatus,
    waitForBootstrapSignal,
  ]);

  // txChanged subscription effect
  useEffect(() => {
    if (!providerReady) return;

    const canton = getProvider();
    if (!canton) return;

    const handleTxChanged = (event: TxEvent) => {
      for (const handler of txHandlersRef.current) {
        handler(event);
      }
    };

    canton.on("txChanged", handleTxChanged as (...args: unknown[]) => void);

    return () => {
      const off = canton.off ?? canton.removeListener;
      if (typeof off === "function") {
        off.call(canton, "txChanged", handleTxChanged as (...args: unknown[]) => void);
      }
    };
  }, [providerReady, getProvider]);

  const value = useMemo(
    (): CantonContextValue => ({
      connectionState,
      isConnected,
      isConnecting,
      accounts,
      activeAccount,
      partyId,
      networkId,
      providerReady,
      connect,
      disconnect,
      reconnect,
      setActiveAccount,
      request,
      onAccountsChanged,
      onTxChanged,
    }),
    [
      connectionState,
      isConnected,
      isConnecting,
      accounts,
      activeAccount,
      partyId,
      networkId,
      providerReady,
      connect,
      disconnect,
      reconnect,
      setActiveAccount,
      request,
      onAccountsChanged,
      onTxChanged,
    ],
  );

  return <CantonContext.Provider value={value}>{children}</CantonContext.Provider>;
}

/**
 * Hook to access Canton context
 * @throws if used outside of CantonReactProvider
 */
export function useCanton(): CantonContextValue {
  const context = useContext(CantonContext);
  if (!context) {
    throw new Error("useCanton must be used within a CantonReactProvider");
  }
  return context;
}
