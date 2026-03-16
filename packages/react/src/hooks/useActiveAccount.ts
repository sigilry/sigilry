/**
 * useActiveAccount - Hook for accessing the currently active account
 *
 * Follows wagmi patterns with { data, isLoading, isError, error }
 */

import { useCanton } from "../context";
import type { Account } from "../types";

export interface UseActiveAccountResult {
  /** The currently active account */
  data: Account | null;
  /** The party ID of the active account */
  partyId: string | null;
  /** Whether account is loading */
  isLoading: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error if any */
  error: Error | null;
  /** Whether the wallet is connected */
  isConnected: boolean;
  /** Set a different account as active */
  setActiveAccount: (partyId: string) => void;
}

/**
 * Hook for accessing the currently active wallet account
 *
 * @example
 * ```tsx
 * function ActiveAccountDisplay() {
 *   const { data: account, partyId, isConnected } = useActiveAccount()
 *
 *   if (!isConnected) return <p>Not connected</p>
 *   if (!account) return <p>No active account</p>
 *
 *   return (
 *     <div>
 *       <p>Active: {account.hint}</p>
 *       <p>Party ID: {partyId}</p>
 *     </div>
 *   )
 * }
 * ```
 */
export function useActiveAccount(): UseActiveAccountResult {
  const { activeAccount, partyId, isConnected, isConnecting, connectionState, setActiveAccount } =
    useCanton();

  const hasError = connectionState.status === "error";
  const error = hasError ? new Error(connectionState.error.message) : null;

  return {
    data: activeAccount,
    partyId,
    isLoading: isConnecting,
    isError: hasError,
    error,
    isConnected,
    setActiveAccount,
  };
}
