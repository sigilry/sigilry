/**
 * useLedgerApi - Hook for making arbitrary Ledger API requests
 *
 * Follows wagmi patterns with { mutate, isPending, isError, error }
 */

import { type UseMutationResult, useMutation } from "@tanstack/react-query";
import type {
  LedgerApiRequest as DappLedgerApiRequest,
  LedgerApiResult,
} from "@sigilry/dapp/schemas";
import { useCanton } from "../context";

/**
 * Ledger API request parameters
 */
export type LedgerApiRequest = DappLedgerApiRequest;

/**
 * Parsed Ledger API response
 */
export interface LedgerApiResponse<T = unknown> {
  /** Raw JSON payload from the API */
  raw: LedgerApiResult;
  /** Parsed response data */
  data: T;
}

export interface UseLedgerApiResult<T = unknown> {
  /** Execute a ledger API request */
  request: (params: LedgerApiRequest) => void;
  /** Execute async with promise return */
  requestAsync: (params: LedgerApiRequest) => Promise<LedgerApiResponse<T>>;
  /** Whether a request is in progress */
  isPending: boolean;
  /** Whether the last request failed */
  isError: boolean;
  /** Error from the last request */
  error: Error | null;
  /** Response data from the last successful request */
  data: LedgerApiResponse<T> | undefined;
  /** Reset the mutation state */
  reset: () => void;
}

export type LedgerApiParser<T> = (input: unknown) => T;

export interface UseLedgerApiOptions<T> {
  /** Parser/validator that narrows unknown JSON payloads to T */
  parse: LedgerApiParser<T>;
}

export function parseLedgerApiResponse<T>(
  payload: unknown,
  parse: LedgerApiParser<T>,
): LedgerApiResponse<T> {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Invalid ledger API response");
  }

  return {
    raw: payload as LedgerApiResult,
    data: parse(payload),
  };
}

/**
 * Hook for making Ledger API requests
 *
 * @example
 * ```tsx
 * import { zGetLedgerEndResponse } from "@sigilry/canton-json-api";
 *
 * function LedgerEndDisplay() {
 *   const { requestAsync, data, isPending } = useLedgerApi({
 *     parse: zGetLedgerEndResponse.parse,
 *   })
 *
 *   const fetchOffset = async () => {
 *     const result = await requestAsync({
 *       requestMethod: 'get',
 *       resource: '/v2/state/ledger-end'
 *     })
 *     console.log('Offset:', result.data)
 *   }
 *
 *   return (
 *     <div>
 *       <button onClick={fetchOffset} disabled={isPending}>
 *         Fetch Ledger End
 *       </button>
 *       {data && <p>Offset: {data.data.offset}</p>}
 *     </div>
 *   )
 * }
 * ```
 */
function useLedgerApiWithParser<T>(options: UseLedgerApiOptions<T>): UseLedgerApiResult<T> {
  const { request: cantonRequest } = useCanton();

  const mutation: UseMutationResult<
    LedgerApiResponse<T>,
    Error,
    DappLedgerApiRequest
  > = useMutation({
    mutationFn: async (params: DappLedgerApiRequest): Promise<LedgerApiResponse<T>> => {
      const result: LedgerApiResult = await cantonRequest("ledgerApi", params);
      return parseLedgerApiResponse(result, options.parse);
    },
  });

  return {
    request: (params) => mutation.mutate(params),
    requestAsync: (params) => mutation.mutateAsync(params),
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  };
}

export function useLedgerApi<T>(options: UseLedgerApiOptions<T>): UseLedgerApiResult<T> {
  return useLedgerApiWithParser(options);
}
