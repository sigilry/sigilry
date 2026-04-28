/**
 * useSignMessage - Hook for requesting wallet signatures
 *
 * Wraps the signMessage RPC call with react-query mutation.
 * Follows wagmi patterns with { signMessage, signMessageAsync, isPending, isError, error, data, reset }.
 */

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import type { SignMessageRequest, SignMessageResult } from "@sigilry/dapp/schemas";
import { useCanton } from "../context";
import type { ParsedError } from "../types";
import { parseError } from "../types";

export interface UseSignMessageResult {
  /** Request a signature from the wallet */
  signMessage: (params: SignMessageRequest) => void;
  /** Request a signature with promise return */
  signMessageAsync: (params: SignMessageRequest) => Promise<SignMessageResult>;
  /** Whether a signing request is in progress */
  isPending: boolean;
  /** Whether the last signing request failed */
  isError: boolean;
  /** Error from the last signing request */
  error: ParsedError | null;
  /** Result from the last successful signing request */
  data: SignMessageResult | undefined;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Hook for requesting a signature from the user's wallet.
 *
 * Wraps the `signMessage` JSON-RPC method with a react-query mutation.
 * Follows wagmi patterns with `{ signMessage, signMessageAsync, isPending, isError, error, data, reset }`.
 *
 * @example
 * ```tsx
 * function SignButton({ message }: { message: string }) {
 *   const { signMessageAsync, isPending, error } = useSignMessage()
 *   const { data: account } = useActiveAccount()
 *
 *   const handleSign = async () => {
 *     const { signature } = await signMessageAsync({ message })
 *     console.log('signed by', account?.partyId, 'sig:', signature)
 *   }
 *
 *   return (
 *     <button onClick={handleSign} disabled={isPending || !account}>
 *       {isPending ? 'Signing...' : 'Sign message'}
 *     </button>
 *   )
 * }
 * ```
 */
export function useSignMessage(): UseSignMessageResult {
  const { request: cantonRequest } = useCanton();

  const mutation: UseMutationResult<SignMessageResult, Error, SignMessageRequest> = useMutation({
    mutationFn: async (params: SignMessageRequest): Promise<SignMessageResult> => {
      return await cantonRequest("signMessage", params);
    },
  });

  return {
    signMessage: (params) => mutation.mutate(params),
    signMessageAsync: (params) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error ? parseError(mutation.error) : null,
    data: mutation.data,
    reset: mutation.reset,
  };
}

export type { SignMessageRequest, SignMessageResult };
