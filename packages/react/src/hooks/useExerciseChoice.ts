/**
 * useExerciseChoice - Hook for exercising choices on Canton contracts
 *
 * Convenience wrapper around useSubmitCommand for the common case of
 * exercising a choice on an existing contract.
 *
 * Follows wagmi patterns with { mutate, isPending, isError, error }
 */

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import { useCanton } from "../context";
import type { ParsedError } from "../types";
import { parseError } from "../types";
import type { ExecutedPayload, SubmitCommandResult } from "./useSubmitCommand";

/**
 * Exercise choice request parameters
 */
export interface ExerciseChoiceRequest {
  /** Contract ID to exercise the choice on */
  contractId: string;
  /** Template ID (e.g., 'Splice.Wallet.Payment:PaymentRequest') */
  templateId: string;
  /** Choice name to exercise */
  choiceName: string;
  /** Choice argument (the payload for the choice) */
  choiceArgument: Record<string, unknown>;
  /** Unique command identifier (auto-generated if not provided) */
  commandId?: string;
  /** Parties that will act as the choice executor */
  actAs?: string[];
  /** Parties that should have read access */
  readAs?: string[];
  /** Synchronizer to use (auto-selected if not provided) */
  synchronizerId?: string;
}

export interface UseExerciseChoiceResult {
  /** Exercise a choice on a contract */
  exercise: (params: ExerciseChoiceRequest) => void;
  /** Exercise async with promise return */
  exerciseAsync: (params: ExerciseChoiceRequest) => Promise<SubmitCommandResult>;
  /** Whether an exercise is in progress */
  isPending: boolean;
  /** Whether the last exercise failed */
  isError: boolean;
  /** Error from the last exercise */
  error: ParsedError | null;
  /** Result from the last successful exercise */
  data: SubmitCommandResult | undefined;
  /** Reset the mutation state */
  reset: () => void;
}

/**
 * Hook for exercising choices on Canton contracts
 *
 * @example
 * ```tsx
 * function AcceptPaymentButton({ contractId }: { contractId: string }) {
 *   const { exercise, isPending, isError, error } = useExerciseChoice()
 *   const { partyId } = useCanton()
 *
 *   const handleAccept = () => {
 *     exercise({
 *       contractId,
 *       templateId: 'Splice.Wallet.Payment:PaymentRequest',
 *       choiceName: 'PaymentRequest_Accept',
 *       choiceArgument: {},
 *       actAs: [partyId],
 *     })
 *   }
 *
 *   return (
 *     <button onClick={handleAccept} disabled={isPending}>
 *       {isPending ? 'Accepting...' : 'Accept Payment'}
 *     </button>
 *   )
 * }
 * ```
 *
 * @example With typed contracts (from @sigilry/cli codegen)
 * ```tsx
 * import { PaymentRequest } from './generated/Splice/Wallet/Payment'
 *
 * function AcceptPaymentButton({ contractId }: { contractId: string }) {
 *   const { exercise, isPending } = useExerciseChoice()
 *   const { partyId } = useCanton()
 *
 *   const handleAccept = () => {
 *     exercise({
 *       contractId,
 *       templateId: PaymentRequest.templateId,
 *       choiceName: 'PaymentRequest_Accept',
 *       choiceArgument: {},
 *       actAs: [partyId],
 *     })
 *   }
 *
 *   return (
 *     <button onClick={handleAccept} disabled={isPending}>
 *       Accept
 *     </button>
 *   )
 * }
 * ```
 */
export function useExerciseChoice(): UseExerciseChoiceResult {
  const { request: cantonRequest } = useCanton();

  const mutation: UseMutationResult<SubmitCommandResult, Error, ExerciseChoiceRequest> =
    useMutation({
      mutationFn: async (params: ExerciseChoiceRequest): Promise<SubmitCommandResult> => {
        // Build the exercise command structure
        const commands = {
          exercise: {
            templateId: params.templateId,
            contractId: params.contractId,
            choiceName: params.choiceName,
            choiceArgument: params.choiceArgument,
          },
        };

        const result = await cantonRequest("prepareExecuteAndWait", {
          commandId: params.commandId,
          commands,
          actAs: params.actAs,
          readAs: params.readAs,
          synchronizerId: params.synchronizerId,
        });

        if (!result?.tx) {
          throw new Error("Invalid prepareExecuteAndWait response: missing tx field");
        }

        if (result.tx.status !== "executed") {
          throw new Error(`Choice exercise not executed: status=${result.tx.status}`);
        }

        return result;
      },
    });

  return {
    exercise: (params) => mutation.mutate(params),
    exerciseAsync: (params) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error ? parseError(mutation.error) : null,
    data: mutation.data,
    reset: mutation.reset,
  };
}

export type { ExecutedPayload, SubmitCommandResult };
