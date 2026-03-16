/**
 * CantonContext - React context for Canton provider state
 *
 * Provides connection state and actions to all child components.
 */

import type React from "react";
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

/**
 * Transform raw wallet data from listAccounts into Account type
 */
function toAccount(wallet: Record<string, unknown>): Account {
  const partyId = String(wallet.partyId ?? "");
  const { hint, namespace } = parsePartyId(partyId);
  const rawStatus = String(wallet.status ?? "");
  const status: Account["status"] =
    rawStatus === "initialized" || rawStatus === "pending" ? "initialized" : "allocated";
  const externalTxId = typeof wallet.externalTxId === "string" ? wallet.externalTxId : undefined;
  const topologyTransactions =
    typeof wallet.topologyTransactions === "string" ? wallet.topologyTransactions : undefined;
  const disabled = typeof wallet.disabled === "boolean" ? wallet.disabled : undefined;
  const reason = typeof wallet.reason === "string" ? wallet.reason : undefined;
  return {
    partyId,
    hint: String(wallet.hint ?? hint),
    namespace: String(wallet.namespace ?? namespace),
    networkId: String(wallet.networkId ?? "canton:localnet"),
    publicKey: String(wallet.publicKey ?? ""),
    primary: Boolean(wallet.primary),
    status,
    signingProviderId: String(wallet.signingProviderId ?? ""),
    externalTxId,
    topologyTransactions,
    disabled,
    reason,
  };
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
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  reconnect: () => Promise<void>;
  setActiveAccount: (partyId: string) => void;
  // RPC helper
  request: <M extends RpcMethodName>(
    method: M,
    ...params: OptionalParams<M>
  ) => Promise<RpcResult<M>>;
  // Event subscription
  onTxChanged: (handler: (event: TxEvent) => void) => () => void;
}

const CantonContext = createContext<CantonContextValue | null>(null);

export interface CantonProviderProps {
  children: ReactNode;
  /** Called when an error occurs */
  onError?: (error: ParsedError) => void;
  /** Called on connection state changes */
  onConnectionChange?: (state: ConnectionState) => void;
}

export function CantonReactProvider({
  children,
  onError,
  onConnectionChange,
}: CantonProviderProps): React.ReactNode {
  // Core connection state using discriminated union
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: "disconnected",
  });
  const [providerReady, setProviderReady] = useState(false);
  const [activePartyId, setActivePartyId] = useState<string | null>(null);

  const initializedRef = useRef(false);
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
    return (window as unknown as { canton?: CantonProvider }).canton ?? null;
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

        // Update connection state on session errors
        if (
          parsed.code === "SESSION_EXPIRED" ||
          parsed.code === "TOKEN_REFRESH_REQUIRED" ||
          parsed.code === "NOT_CONNECTED"
        ) {
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

  // Fetch accounts and update state
  const fetchAccounts = useCallback(async (): Promise<Account[]> => {
    try {
      const result = await request("listAccounts");
      if (Array.isArray(result) && result.length > 0) {
        return result.map((w) => toAccount(w as Record<string, unknown>));
      }
      return [];
    } catch {
      return [];
    }
  }, [request]);

  // Connect action
  const connect = useCallback(async () => {
    setConnectionState({ status: "connecting" });

    try {
      const result = await request("connect");
      if (result?.isConnected) {
        const fetchedAccounts = await fetchAccounts();
        const primaryAccount =
          fetchedAccounts.find((account) => account.primary) ?? fetchedAccounts[0] ?? null;

        if (primaryAccount) {
          setConnectionState({
            status: "connected",
            accounts: fetchedAccounts,
            networkId: result.network?.networkId ?? "canton:localnet",
          });
          setActivePartyId(primaryAccount.partyId);
        } else {
          setConnectionState({
            status: "error",
            error: {
              message: "Connected but no accounts available",
              code: "NOT_CONNECTED",
              action: { type: "reconnect" },
            },
          });
        }
      }
    } catch (err) {
      const parsed = parseError(err);
      setConnectionState({ status: "error", error: parsed });
      onError?.(parsed);
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

      setProviderReady(true);

      // Check initial status and restore session
      try {
        const statusResult = await request("status");

        if (statusResult?.isConnected) {
          const accountsResult = await request("listAccounts");
          if (Array.isArray(accountsResult) && accountsResult.length > 0) {
            const restoredAccounts = accountsResult.map((w) =>
              toAccount(w as Record<string, unknown>),
            );
            const primaryAccount =
              restoredAccounts.find((account) => account.primary) ?? restoredAccounts[0] ?? null;
            setConnectionState({
              status: "connected",
              accounts: restoredAccounts,
              networkId: statusResult.network?.networkId ?? "canton:localnet",
            });
            setActivePartyId(primaryAccount?.partyId ?? null);
          }
        }
      } catch {
        // Ignore status errors during init
      }
    };

    init();
  }, [getProvider, request]);

  // Event subscription effect
  useEffect(() => {
    if (!providerReady) return;

    const canton = getProvider();
    if (!canton) return;

    const handleTxChanged = (event: TxEvent) => {
      for (const handler of txHandlersRef.current) {
        handler(event);
      }
    };

    const handleAccountsChanged = (rawAccounts: unknown[]) => {
      if (!rawAccounts || rawAccounts.length === 0) {
        setConnectionState((prev) => {
          const lastAccounts = prev.status === "connected" ? prev.accounts : undefined;
          return { status: "session_expired", lastAccounts };
        });
        return;
      }

      const newAccounts = rawAccounts.map((w) => toAccount(w as Record<string, unknown>));
      const primaryAccount =
        newAccounts.find((account) => account.primary) ?? newAccounts[0] ?? null;

      setConnectionState((prev) => {
        const currentNetworkId =
          prev.status === "connected"
            ? prev.networkId
            : (primaryAccount?.networkId ?? "canton:localnet");
        return {
          status: "connected",
          accounts: newAccounts,
          networkId: currentNetworkId,
        };
      });

      setActivePartyId((prev) => prev ?? primaryAccount?.partyId ?? null);
    };

    canton.on("txChanged", handleTxChanged as (...args: unknown[]) => void);
    canton.on("accountsChanged", handleAccountsChanged as (...args: unknown[]) => void);

    return () => {
      const off = canton.off ?? canton.removeListener;
      if (typeof off === "function") {
        off.call(canton, "txChanged", handleTxChanged as (...args: unknown[]) => void);
        off.call(canton, "accountsChanged", handleAccountsChanged as (...args: unknown[]) => void);
      }
    };
  }, [providerReady, getProvider, activePartyId]);

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
