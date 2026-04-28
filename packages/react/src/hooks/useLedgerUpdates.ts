/**
 * useLedgerUpdates - Hook for polling ledger updates from /v2/updates
 *
 * Provides real-time(ish) ledger updates through optimized polling.
 * Tracks offset between polls to avoid duplicate processing.
 *
 * Note: Canton's gRPC UpdateService.GetUpdates is server_streaming,
 * but JSON API proxies as HTTP. This hook uses polling with offset tracking.
 * Future: evaluate SSE/WebSocket for true streaming.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { EventFormat, GetUpdatesRequest, TransactionFormat } from "@sigilry/canton-json-api";
import { useCanton } from "../context";
import { parseError } from "../types";
import {
  applyPrunedOffsetFloor,
  buildUpdatesFlatsRequestBody,
  deriveRecentBeginExclusive,
  isMaximumListElementsError,
  parseLatestPrunedOffsetResponse,
  parseLedgerEndResponse,
  parseLedgerOffsetInput,
  type ParsedTransaction,
  parseUpdatesFlatsResponse,
  type UpdatesFlatsRequestBody,
} from "./ledgerApiContract";
import type { CantonTemplateFilter } from "./ledgerFilters";
import { buildFiltersByParty } from "./ledgerFilters";

/**
 * Created event from a transaction
 */
export interface CreatedEvent {
  type: "created";
  contractId: string;
  templateId: string;
  payload: Record<string, unknown>;
  signatories?: string[];
  observers?: string[];
}

/**
 * Archived event from a transaction
 */
export interface ArchivedEvent {
  type: "archived";
  contractId: string;
  templateId: string;
}

/**
 * Union type for contract events
 */
export type ContractEvent = CreatedEvent | ArchivedEvent;

/**
 * Transaction update from the ledger
 */
export interface TransactionUpdate {
  updateId: string;
  commandId?: string;
  /** Ledger offset as string to preserve precision */
  offset: string;
  effectiveAt: string;
  events: ContractEvent[];
}

/**
 * Template filter for updates
 */
export type UpdateTemplateFilter = CantonTemplateFilter;

export interface UseLedgerUpdatesOptions {
  /** Polling interval in milliseconds (default: 2000) */
  pollingInterval?: number;
  /** Whether to enable updates (default: true when connected) */
  enabled?: boolean;
  /** Template filter to limit updates to specific templates */
  templateFilter?: UpdateTemplateFilter;
  /** Callback when new updates arrive */
  onUpdate?: (updates: TransactionUpdate[]) => void;
  /** Maximum updates to keep in history (default: 100) */
  maxHistory?: number;
  /** Initial offset to start polling from (skips ledger-end fetch if provided) */
  initialOffset?: string;
}

export interface UseLedgerUpdatesResult {
  /** All updates received since hook mounted */
  updates: TransactionUpdate[];
  /** Most recent update */
  latestUpdate: TransactionUpdate | undefined;
  /** Current offset being tracked (string to preserve precision) */
  currentOffset: string | undefined;
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether a poll is in progress */
  isPolling: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error if any */
  error: Error | null;
  /** Connection health status */
  connectionStatus: "connected" | "polling" | "error" | "disconnected";
  /** Time since last successful poll in ms */
  lastPollAge: number | undefined;
  /** Manually trigger a poll */
  poll: () => void;
  /** Clear update history */
  clearHistory: () => void;
}

function hasTransaction(entry: {
  transaction?: ParsedTransaction;
}): entry is { transaction: ParsedTransaction } {
  return entry.transaction !== undefined;
}

function toErrorState(err: unknown): Error {
  const parsed = parseError(err);
  return Object.assign(new Error(parsed.message), parsed);
}

export function selectLatestOffset(
  entries: ReadonlyArray<Pick<TransactionUpdate, "offset">>,
): string | undefined {
  if (entries.length === 0) {
    return undefined;
  }

  return entries.reduce(
    (max, entry) => (BigInt(entry.offset) > BigInt(max) ? entry.offset : max),
    entries[0].offset,
  );
}

/**
 * Hook for polling ledger updates
 *
 * @example
 * ```tsx
 * function UpdatesPanel() {
 *   const { updates, isPolling, connectionStatus } = useLedgerUpdates({
 *     pollingInterval: 2000,
 *     onUpdate: (newUpdates) => {
 *       console.log('New updates:', newUpdates)
 *     }
 *   })
 *
 *   return (
 *     <div>
 *       <span>Status: {connectionStatus}</span>
 *       <ul>
 *         {updates.map(u => (
 *           <li key={u.updateId}>{u.updateId}</li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */
export function useLedgerUpdates(options: UseLedgerUpdatesOptions = {}): UseLedgerUpdatesResult {
  const {
    pollingInterval = 2000,
    enabled,
    templateFilter,
    onUpdate,
    maxHistory = 100,
    initialOffset: providedInitialOffset,
  } = options;

  const { request, isConnected, partyId } = useCanton();

  // State
  const [updates, setUpdates] = useState<TransactionUpdate[]>([]);
  const [currentOffset, setCurrentOffset] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastPollTime, setLastPollTime] = useState<number | undefined>(undefined);

  // Refs for stable callbacks
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  const queryEnabled = (enabled ?? isConnected) && !!partyId;

  const readLatestPrunedOffset = useCallback(async (): Promise<string | undefined> => {
    try {
      const result = await request("ledgerApi", {
        requestMethod: "get",
        resource: "/v2/state/latest-pruned-offsets",
      });
      return parseLatestPrunedOffsetResponse(result).participantPrunedUpToInclusive;
    } catch {
      return undefined;
    }
  }, [request]);

  const applyLatestPrunedOffsetFloor = useCallback(
    async (beginExclusive: string): Promise<string> => {
      const prunedOffset = await readLatestPrunedOffset();
      if (prunedOffset === undefined) {
        return beginExclusive;
      }

      return applyPrunedOffsetFloor({ beginExclusive }, prunedOffset).beginExclusive;
    },
    [readLatestPrunedOffset],
  );

  // Fetch current ledger end to initialize offset
  const initializeOffset = useCallback(async (): Promise<string> => {
    const result = await request("ledgerApi", {
      requestMethod: "get",
      resource: "/v2/state/ledger-end",
    });
    return applyLatestPrunedOffsetFloor(parseLedgerEndResponse(result).offset);
  }, [request, applyLatestPrunedOffsetFloor]);

  // Poll for updates since last offset
  const pollUpdates = useCallback(async () => {
    if (!partyId || currentOffset === undefined) return;

    setIsPolling(true);
    try {
      const filtersByParty = buildFiltersByParty(partyId, templateFilter);
      const eventFormat: EventFormat = {
        filtersByParty,
        verbose: true,
      };
      const transactionFormat: TransactionFormat = {
        eventFormat,
        transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
      };
      const updateFormat: NonNullable<GetUpdatesRequest["updateFormat"]> = {
        includeTransactions: transactionFormat,
      };

      const requestUpdates = async (body: UpdatesFlatsRequestBody) => {
        const result = await request("ledgerApi", {
          requestMethod: "post",
          resource: "/v2/updates/flats",
          body,
        });
        return parseUpdatesFlatsResponse(result);
      };

      const body = buildUpdatesFlatsRequestBody(currentOffset, updateFormat);
      let retryBeginExclusive: string | undefined;
      let parsed: ReturnType<typeof parseUpdatesFlatsResponse>;

      try {
        parsed = await requestUpdates(body);
      } catch (err) {
        if (!isMaximumListElementsError(err)) {
          throw err;
        }

        const ledgerEndResult = await request("ledgerApi", {
          requestMethod: "get",
          resource: "/v2/state/ledger-end",
        });
        retryBeginExclusive = deriveRecentBeginExclusive(
          body,
          parseLedgerEndResponse(ledgerEndResult).offset,
        );
        parsed = await requestUpdates({
          ...body,
          beginExclusive: parseLedgerOffsetInput(retryBeginExclusive),
        });
      }

      const newUpdates: TransactionUpdate[] = (parsed.update ?? [])
        .filter(hasTransaction)
        .map((u) => {
          const tx = u.transaction;
          const events: ContractEvent[] = tx.events.map((e) => {
            if (e.kind === "created") {
              return {
                type: "created",
                contractId: e.created.contractId,
                templateId: e.created.templateId,
                payload: e.created.createArgument ?? {},
                signatories: e.created.signatories,
                observers: e.created.observers,
              };
            }

            return {
              type: "archived",
              contractId: e.archived.contractId,
              templateId: e.archived.templateId,
            };
          });

          return {
            updateId: tx.updateId,
            commandId: tx.commandId,
            // Always keep offset as string to preserve precision
            offset: tx.offset,
            effectiveAt: tx.effectiveAt ?? "",
            events,
          };
        });

      if (newUpdates.length > 0) {
        const latestOffset = selectLatestOffset(newUpdates);
        if (latestOffset !== undefined) {
          setCurrentOffset(latestOffset);
        }

        // Add to history (capped)
        setUpdates((prev) => {
          const combined = [...prev, ...newUpdates];
          return combined.slice(-maxHistory);
        });

        // Notify callback
        onUpdateRef.current?.(newUpdates);
      } else if (retryBeginExclusive !== undefined) {
        // A successful retry from a recent window should not leave the hook stuck on the
        // oversized default offset that triggered the retry.
        setCurrentOffset(retryBeginExclusive);
      }

      setError(null);
      setLastPollTime(Date.now());
    } catch (err) {
      setError(toErrorState(err));
    } finally {
      setIsPolling(false);
    }
  }, [partyId, currentOffset, templateFilter, request, maxHistory]);

  // Initialize offset on mount (use provided offset if available, otherwise fetch ledger-end)
  useEffect(() => {
    if (!queryEnabled) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      setIsLoading(true);
      setError(null);
      setCurrentOffset(undefined);
      setLastPollTime(undefined);

      try {
        const offset =
          providedInitialOffset !== undefined
            ? await applyLatestPrunedOffsetFloor(parseLedgerOffsetInput(providedInitialOffset))
            : await initializeOffset();
        if (!cancelled) {
          setCurrentOffset(offset);
          setLastPollTime(Date.now());
        }
      } catch (err) {
        if (!cancelled) {
          setError(toErrorState(err));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [queryEnabled, initializeOffset, providedInitialOffset, applyLatestPrunedOffsetFloor]);

  // Polling interval
  useEffect(() => {
    if (!queryEnabled || isLoading || currentOffset === undefined) return;

    const interval = setInterval(pollUpdates, pollingInterval);
    return () => clearInterval(interval);
  }, [queryEnabled, isLoading, currentOffset, pollingInterval, pollUpdates]);

  // Calculate last poll age
  const [lastPollAge, setLastPollAge] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!lastPollTime) {
      setLastPollAge(undefined);
      return;
    }

    const updateAge = () => {
      setLastPollAge(Date.now() - lastPollTime);
    };

    updateAge();
    const interval = setInterval(updateAge, 1000);
    return () => clearInterval(interval);
  }, [lastPollTime]);

  // Determine connection status
  const connectionStatus = !queryEnabled
    ? "disconnected"
    : error
      ? "error"
      : isPolling
        ? "polling"
        : "connected";

  // Manual poll trigger
  const poll = useCallback(() => {
    if (currentOffset !== undefined) {
      pollUpdates();
    }
  }, [currentOffset, pollUpdates]);

  // Clear history
  const clearHistory = useCallback(() => {
    setUpdates([]);
  }, []);

  return {
    updates,
    latestUpdate: updates[updates.length - 1],
    currentOffset,
    isLoading,
    isPolling,
    isError: !!error,
    error,
    connectionStatus,
    lastPollAge,
    poll,
    clearHistory,
  };
}
