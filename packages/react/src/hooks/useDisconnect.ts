/**
 * useDisconnect - Hook for disconnecting from Canton wallet
 *
 * Follows wagmi patterns with { mutate, isPending, isError, error }
 */

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { useCanton } from "../context";

export interface UseDisconnectResult {
  /** Disconnect from the wallet */
  disconnect: () => void;
  /** Disconnect async with promise return */
  disconnectAsync: () => Promise<void>;
  /** Whether a disconnect is in progress */
  isPending: boolean;
  /** Whether the last disconnect attempt failed */
  isError: boolean;
  /** Error from the last disconnect attempt */
  error: Error | null;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Hook for disconnecting from the Canton wallet extension
 *
 * @example
 * ```tsx
 * function DisconnectButton() {
 *   const { disconnect, isPending } = useDisconnect()
 *
 *   return (
 *     <button onClick={disconnect} disabled={isPending}>
 *       Disconnect
 *     </button>
 *   )
 * }
 * ```
 */
export function useDisconnect(): UseDisconnectResult {
  const { disconnect: contextDisconnect } = useCanton();

  const mutation: UseMutationResult<void, Error, void> = useMutation({
    mutationFn: contextDisconnect,
  });

  return {
    disconnect: () => mutation.mutate(),
    disconnectAsync: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    reset: mutation.reset,
  };
}
