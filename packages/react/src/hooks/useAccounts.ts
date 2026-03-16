/**
 * useAccounts - Hook for accessing Canton wallet accounts
 *
 * Follows wagmi patterns with { data, isLoading, isError, error }
 */

import { useCanton } from "../context";
import type { Account } from "../types";

export interface UseAccountsResult {
  /** List of connected accounts */
  data: Account[];
  /** Whether accounts are loading (during initial connection) */
  isLoading: boolean;
  /** Whether there was an error getting accounts */
  isError: boolean;
  /** Error if accounts could not be retrieved */
  error: Error | null;
  /** Whether the wallet is connected */
  isConnected: boolean;
}

/**
 * Hook for accessing connected wallet accounts
 *
 * @example
 * ```tsx
 * function AccountList() {
 *   const { data: accounts, isConnected } = useAccounts()
 *
 *   if (!isConnected) return <p>Not connected</p>
 *
 *   return (
 *     <ul>
 *       {accounts.map(account => (
 *         <li key={account.partyId}>{account.hint}</li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useAccounts(): UseAccountsResult {
  const { accounts, isConnected, isConnecting, connectionState } = useCanton();

  const hasError = connectionState.status === "error";
  const error = hasError ? new Error(connectionState.error.message) : null;

  return {
    data: accounts,
    isLoading: isConnecting,
    isError: hasError,
    error,
    isConnected,
  };
}
