/**
 * useActiveContracts - Hook for querying active contracts on the ledger
 *
 * Follows wagmi patterns with { data, isLoading, isError, error, refetch }
 */

import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import type { EventFormat } from "@sigilry/canton-json-api";
import { useCanton } from "../context";
import {
  buildActiveContractsRequestBody,
  parseActiveContractsResponse,
  parseLedgerEndResponse,
  type ParsedActiveContractsCreatedEvent,
  type ParsedActiveContractsEntry,
} from "./ledgerApiContract";
import type { CantonTemplateFilter } from "./ledgerFilters";
import { buildFiltersByParty } from "./ledgerFilters";

/**
 * Contract data from active contracts query
 */
export interface ActiveContract {
  contractId: string;
  templateId: string;
  payload: Record<string, unknown>;
  createdAt?: string;
  signatories?: string[];
  observers?: string[];
}

/**
 * Response from ledgerApi POST /v2/state/active-contracts
 */
export interface ActiveContractsResponse {
  contracts: ActiveContract[];
  offset: string;
}

/**
 * Template filter for Canton Ledger API
 * Format: { packageName, moduleName, entityName } or qualified string "#pkg:mod:entity"
 */
export type TemplateFilter = CantonTemplateFilter;

export interface UseActiveContractsOptions {
  /**
   * Template filter for contract queries.
   * Provide as { packageName, moduleName, entityName } object.
   * When omitted, returns all contracts for the party.
   */
  templateFilter?: TemplateFilter;
  /** Whether to enable the query (default: true when connected) */
  enabled?: boolean;
  /** Polling interval in milliseconds (default: disabled) */
  refetchInterval?: number;
}

export interface UseActiveContractsResult {
  /** List of active contracts */
  data: ActiveContract[];
  /** Raw response from ledger API */
  rawData: ActiveContractsResponse | undefined;
  /** Current ledger offset */
  offset: string | undefined;
  /** Whether the query is loading */
  isLoading: boolean;
  /** Whether the query is fetching (includes background refetches) */
  isFetching: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error if any */
  error: Error | null;
  /** Manually refetch the contracts */
  refetch: () => void;
}

const getCreatedEvent = (
  entry: ParsedActiveContractsEntry,
): ParsedActiveContractsCreatedEvent | undefined => {
  return entry.contractEntry?.JsActiveContract?.createdEvent;
};

/**
 * Hook for querying active contracts
 *
 * @example
 * ```tsx
 * function ContractList() {
 *   const { data: contracts, isLoading } = useActiveContracts({
 *     templateFilter: {
 *       packageName: 'splice-wallet-payment',
 *       moduleName: 'Splice.Wallet.Payment',
 *       entityName: 'TransferPreapproval',
 *     }
 *   })
 *
 *   if (isLoading) return <p>Loading...</p>
 *
 *   return (
 *     <ul>
 *       {contracts.map(contract => (
 *         <li key={contract.contractId}>{contract.templateId}</li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useActiveContracts(
  options: UseActiveContractsOptions = {},
): UseActiveContractsResult {
  const { templateFilter, enabled, refetchInterval } = options;
  const { request, isConnected, partyId } = useCanton();

  const queryEnabled = (enabled ?? isConnected) && !!partyId;

  const query: UseQueryResult<ActiveContractsResponse, Error> = useQuery({
    queryKey: ["canton", "activeContracts", partyId, templateFilter],
    queryFn: async (): Promise<ActiveContractsResponse> => {
      if (!partyId) throw new Error("No active party");

      const filtersByParty = buildFiltersByParty(partyId, templateFilter);
      const eventFormat: EventFormat = {
        filtersByParty,
        verbose: true,
      };

      // First fetch current ledger end offset - activeAtOffset: 0 means "beginning" not "current"
      let activeAtOffset = "0";
      try {
        const ledgerEndResult = await request("ledgerApi", {
          requestMethod: "GET",
          resource: "/v2/state/ledger-end",
        });
        if (ledgerEndResult?.response) {
          activeAtOffset = parseLedgerEndResponse(ledgerEndResult.response).offset;
        }
      } catch {
        // If ledger-end fails, continue with 0 (will likely return empty)
      }

      const result = await request("ledgerApi", {
        requestMethod: "POST",
        resource: "/v2/state/active-contracts",
        body: buildActiveContractsRequestBody(activeAtOffset, eventFormat),
      });

      // Parse the response JSON string
      if (result?.response) {
        const entries: ParsedActiveContractsEntry[] = parseActiveContractsResponse(result.response);
        const contracts: ActiveContract[] = entries
          .map(getCreatedEvent)
          .filter((entry): entry is ParsedActiveContractsCreatedEvent => Boolean(entry))
          .map((createdEvent) => ({
            contractId: createdEvent.contractId,
            templateId: createdEvent.templateId,
            payload: createdEvent.createArgument ?? {},
            createdAt: createdEvent.createdAt,
            signatories: createdEvent.signatories,
            observers: createdEvent.observers,
          }));

        return {
          contracts,
          offset: String(activeAtOffset),
        };
      }
      throw new Error("Invalid active contracts response");
    },
    enabled: queryEnabled,
    refetchInterval: queryEnabled && refetchInterval ? refetchInterval : false,
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  return {
    data: query.data?.contracts ?? [],
    rawData: query.data,
    offset: query.data?.offset,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    error: query.error,
    refetch: () => {
      query.refetch();
    },
  };
}
