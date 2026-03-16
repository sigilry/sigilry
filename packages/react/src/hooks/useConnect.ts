/**
 * useConnect - Hook for connecting to Canton wallet
 *
 * Follows wagmi patterns with { data, isLoading, isError, error, mutate }
 */

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { useCanton } from "../context";
import type { ParsedError } from "../types";

export interface UseConnectResult {
  /** Connect to the wallet */
  connect: () => void;
  /** Connect async with promise return */
  connectAsync: () => Promise<void>;
  /** Whether a connection is in progress */
  isPending: boolean;
  /** Whether the last connect attempt failed */
  isError: boolean;
  /** Error from the last connect attempt */
  error: ParsedError | null;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Hook for connecting to the Canton wallet extension
 *
 * @example
 * ```tsx
 * function ConnectButton() {
 *   const { connect, isPending, isError, error } = useConnect()
 *
 *   return (
 *     <button onClick={connect} disabled={isPending}>
 *       {isPending ? 'Connecting...' : 'Connect'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useConnect(): UseConnectResult {
  const { connect: contextConnect } = useCanton();

  const mutation: UseMutationResult<void, Error, void> = useMutation({
    mutationFn: contextConnect,
  });

  return {
    connect: () => mutation.mutate(),
    connectAsync: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error
      ? {
          message: mutation.error.message,
          code: "INTERNAL_ERROR",
          action: { type: "retry" as const },
          raw: mutation.error,
        }
      : null,
    reset: mutation.reset,
  };
}
