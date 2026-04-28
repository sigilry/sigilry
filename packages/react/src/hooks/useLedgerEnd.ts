/**
 * useLedgerEnd - Hook for polling the current ledger end offset
 *
 * Follows wagmi patterns with { data, isLoading, isError, error, refetch }
 */

import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { useCanton } from "../context";
import {
  parseLedgerEndResponse as parseLedgerEndResponseContract,
  type LedgerOffset,
} from "./ledgerApiContract";

/**
 * Response from ledgerApi GET /v2/state/ledger-end
 */
export interface LedgerEndResponse {
  offset: LedgerOffset;
}

export interface UseLedgerEndOptions {
  /** Polling interval in milliseconds (default: 5000) */
  refetchInterval?: number;
  /** Whether to enable the query (default: true when connected) */
  enabled?: boolean;
}

export interface UseLedgerEndResult {
  /** The current ledger end offset */
  data: string | undefined;
  /** Raw response from ledger API */
  rawData: LedgerEndResponse | undefined;
  /** Whether the query is loading */
  isLoading: boolean;
  /** Whether the query is fetching (includes background refetches) */
  isFetching: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error if any */
  error: Error | null;
  /** Manually refetch the ledger end */
  refetch: () => void;
}

export function parseLedgerEndResponse(payload: unknown): LedgerEndResponse {
  return parseLedgerEndResponseContract(payload);
}

/**
 * Hook for polling the ledger end offset
 *
 * @example
 * ```tsx
 * function LedgerStatus() {
 *   const { data: offset, isFetching } = useLedgerEnd({ refetchInterval: 2000 })
 *
 *   return (
 *     <div>
 *       <span>Offset: {offset ?? 'Loading...'}</span>
 *       {isFetching && <span className="pulse" />}
 *     </div>
 *   )
 * }
 * ```
 */
export function useLedgerEnd(options: UseLedgerEndOptions = {}): UseLedgerEndResult {
  const { refetchInterval = 5000, enabled } = options;
  const { request, isConnected } = useCanton();

  const queryEnabled = enabled ?? isConnected;

  const query: UseQueryResult<LedgerEndResponse, Error> = useQuery({
    queryKey: ["canton", "ledgerEnd"],
    queryFn: async (): Promise<LedgerEndResponse> => {
      const result = await request("ledgerApi", {
        requestMethod: "get",
        resource: "/v2/state/ledger-end",
      });

      return parseLedgerEndResponse(result);
    },
    enabled: queryEnabled,
    refetchInterval: queryEnabled ? refetchInterval : false,
    staleTime: 1000, // Consider data stale after 1 second
  });

  return {
    data: query.data?.offset,
    rawData: query.data,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => {
      query.refetch();
    },
  };
}
