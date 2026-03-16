/**
 * useSubmitCommand - Hook for submitting commands to the Canton ledger
 *
 * Wraps prepareExecuteAndWait RPC call with react-query mutation.
 * Follows wagmi patterns with { mutate, isPending, isError, error }
 */

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import type {
  JsPrepareSubmissionRequest,
  PrepareExecuteAndWaitResult,
  TxChangedExecutedPayload,
} from "@sigilry/dapp/schemas";
import { useCanton } from "../context";
import type { ParsedError } from "../types";
import { parseError } from "../types";

/**
 * Command submission request parameters
 *
 * Commands are JS objects representing DAML commands (Create, Exercise, etc.)
 */
export type SubmitCommandRequest = JsPrepareSubmissionRequest;

/**
 * Executed transaction payload
 */
export type ExecutedPayload = TxChangedExecutedPayload;

/**
 * Command submission result
 */
export type SubmitCommandResult = PrepareExecuteAndWaitResult;

export interface UseSubmitCommandResult {
  /** Submit a command */
  submit: (params: SubmitCommandRequest) => void;
  /** Submit async with promise return */
  submitAsync: (params: SubmitCommandRequest) => Promise<SubmitCommandResult>;
  /** Whether a submission is in progress */
  isPending: boolean;
  /** Whether the last submission failed */
  isError: boolean;
  /** Error from the last submission */
  error: ParsedError | null;
  /** Result from the last successful submission */
  data: SubmitCommandResult | undefined;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Hook for submitting commands to the Canton ledger
 *
 * @example
 * ```tsx
 * function TransferButton() {
 *   const { submit, isPending, isError, error, data } = useSubmitCommand()
 *   const { partyId } = useCanton()
 *
 *   const handleTransfer = () => {
 *     submit({
 *       commands: {
 *         // DAML command structure
 *         templateId: 'Module:Template',
 *         choice: 'Transfer',
 *         argument: { recipient: 'alice::1234' },
 *       },
 *       actAs: [partyId],
 *     })
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={handleTransfer} disabled={isPending}>
 *         {isPending ? 'Submitting...' : 'Transfer'}
 *       </button>
 *       {isError && <p>Error: {error?.message}</p>}
 *       {data && <p>Success! Update ID: {data.tx.payload.updateId}</p>}
 *     </div>
 *   )
 * }
 * ```
 */
export function useSubmitCommand(): UseSubmitCommandResult {
  const { request: cantonRequest } = useCanton();

  const mutation: UseMutationResult<SubmitCommandResult, Error, SubmitCommandRequest> = useMutation(
    {
      mutationFn: async (params: SubmitCommandRequest): Promise<SubmitCommandResult> => {
        const result = await cantonRequest("prepareExecuteAndWait", params);

        if (!result?.tx) {
          throw new Error("Invalid prepareExecuteAndWait response: missing tx field");
        }

        if (result.tx.status !== "executed") {
          throw new Error(`Transaction not executed: status=${result.tx.status}`);
        }

        return result;
      },
    },
  );

  return {
    submit: (params) => mutation.mutate(params),
    submitAsync: (params) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error ? parseError(mutation.error) : null,
    data: mutation.data,
    reset: mutation.reset,
  };
}
