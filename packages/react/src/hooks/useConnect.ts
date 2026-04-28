/**
 * useConnect - Hook for connecting to Canton wallet
 *
 * Follows wagmi patterns with { data, isLoading, isError, error, mutate }
 */

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { useCanton } from "../context";
import type { ParsedError } from "../types";
import { parseError } from "../types";
import type { ConnectResult } from "@sigilry/dapp/schemas";

function isParsedError(error: unknown): error is ParsedError {
  if (typeof error !== "object" || error === null) return false;

  const candidate = error as Partial<ParsedError>;
  return typeof candidate.message === "string" && typeof candidate.action === "object";
}

export interface UseConnectResult {
  /** Connect to the wallet */
  connect: () => void;
  /** Connect async with promise return */
  connectAsync: () => Promise<ConnectResult>;
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

  const mutation: UseMutationResult<ConnectResult, ParsedError, void> = useMutation({
    mutationFn: async (): Promise<ConnectResult> => {
      try {
        return await contextConnect();
      } catch (error) {
        throw isParsedError(error) ? error : parseError(error);
      }
    },
  });

  return {
    connect: () => mutation.mutate(),
    connectAsync: () => mutation.mutateAsync(),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error ?? null,
    reset: mutation.reset,
  };
}
