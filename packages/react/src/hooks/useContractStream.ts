/**
 * useContractStream - Convenience hook for streaming contract changes
 *
 * Combines useActiveContracts (initial state) + useLedgerUpdates (changes)
 * to provide a live-updating contract list with add/remove animations.
 *
 * This is a higher-level abstraction over the raw ledger updates hook,
 * suitable for building live contract lists in dApps.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ActiveContract, TemplateFilter } from "./useActiveContracts";
import { useActiveContracts } from "./useActiveContracts";
import type { TransactionUpdate, UpdateTemplateFilter } from "./useLedgerUpdates";
import { useLedgerUpdates } from "./useLedgerUpdates";

/**
 * Contract with stream metadata for animations
 */
export interface StreamedContract extends ActiveContract {
  /** When the contract was first seen (for animation timing) */
  streamedAt: number;
  /** Whether this contract was just added (for enter animation) */
  isNew: boolean;
  /** Whether this contract is being removed (for exit animation) */
  isRemoving: boolean;
}

export interface UseContractStreamOptions {
  /** Template filter for contracts to watch */
  templateFilter?: TemplateFilter;
  /** Polling interval in milliseconds (default: 2000) */
  pollingInterval?: number;
  /** Whether to enable the stream (default: true when connected) */
  enabled?: boolean;
  /** Duration to keep isNew flag (ms, default: 2000) */
  newDuration?: number;
  /** Duration to keep isRemoving before actually removing (ms, default: 500) */
  removeDuration?: number;
  /** Callback when contracts change */
  onChange?: (contracts: StreamedContract[]) => void;
}

export interface UseContractStreamResult {
  /** Current list of contracts with stream metadata */
  contracts: StreamedContract[];
  /** Number of active contracts */
  count: number;
  /** Whether initial load is in progress */
  isLoading: boolean;
  /** Whether updates are being polled */
  isPolling: boolean;
  /** Whether there was an error */
  isError: boolean;
  /** Error if any */
  error: Error | null;
  /** Connection status */
  connectionStatus: "connected" | "polling" | "error" | "disconnected";
  /** Current ledger offset (string to preserve precision) */
  offset: string | undefined;
  /** Manually refresh contracts */
  refresh: () => void;
}

/**
 * Hook for streaming live contract updates
 *
 * @example
 * ```tsx
 * function ContractList() {
 *   const { contracts, isLoading, count } = useContractStream({
 *     templateFilter: {
 *       packageName: 'splice-wallet-payment',
 *       moduleName: 'Splice.Wallet.Payment',
 *       entityName: 'TransferPreapproval',
 *     },
 *     pollingInterval: 2000,
 *   })
 *
 *   if (isLoading) return <p>Loading contracts...</p>
 *
 *   return (
 *     <div>
 *       <h2>{count} Contracts</h2>
 *       <ul>
 *         {contracts.map(contract => (
 *           <li
 *             key={contract.contractId}
 *             className={contract.isNew ? 'animate-in' : contract.isRemoving ? 'animate-out' : ''}
 *           >
 *             {contract.templateId}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   )
 * }
 * ```
 */
export function useContractStream(options: UseContractStreamOptions = {}): UseContractStreamResult {
  const {
    templateFilter,
    pollingInterval = 2000,
    enabled,
    newDuration = 2000,
    removeDuration = 500,
    onChange,
  } = options;

  // Track streamed contracts with metadata
  const [streamedContracts, setStreamedContracts] = useState<Map<string, StreamedContract>>(
    new Map(),
  );

  // Initial contracts load
  const {
    data: initialContracts,
    offset: initialOffset,
    isLoading: isInitialLoading,
    isError: isInitialError,
    error: initialError,
    refetch,
  } = useActiveContracts({
    templateFilter,
    enabled,
  });

  // Convert TemplateFilter to UpdateTemplateFilter (same shape)
  const updateFilter: UpdateTemplateFilter | undefined = templateFilter;

  // Live updates - start from the snapshot offset to avoid missing updates
  const {
    currentOffset,
    isPolling,
    isError: isUpdatesError,
    error: updatesError,
    connectionStatus,
    poll,
  } = useLedgerUpdates({
    templateFilter: updateFilter,
    pollingInterval,
    enabled: enabled !== false && !isInitialLoading && initialOffset !== undefined,
    // Start polling from the snapshot offset to avoid missing updates between snapshot and now
    initialOffset: initialOffset ?? undefined,
    onUpdate: useCallback((newUpdates: TransactionUpdate[]) => {
      const now = Date.now();

      setStreamedContracts((prev) => {
        const next = new Map(prev);

        for (const update of newUpdates) {
          for (const event of update.events) {
            if (event.type === "created") {
              // Add new contract
              next.set(event.contractId, {
                contractId: event.contractId,
                templateId: event.templateId,
                payload: event.payload,
                signatories: event.signatories,
                observers: event.observers,
                streamedAt: now,
                isNew: true,
                isRemoving: false,
              });
            } else if (event.type === "archived") {
              // Mark for removal
              const existing = next.get(event.contractId);
              if (existing) {
                next.set(event.contractId, {
                  ...existing,
                  isRemoving: true,
                  isNew: false,
                });
              }
            }
          }
        }

        return next;
      });
    }, []),
  });

  // Initialize from initial contracts (or clear when empty)
  useEffect(() => {
    if (isInitialLoading) return;

    // Always update the map - including clearing it when initialContracts is empty
    // This handles filter changes, party changes, or when the correct state is empty
    const now = Date.now();
    setStreamedContracts(
      new Map(
        initialContracts.map((c) => [
          c.contractId,
          {
            ...c,
            streamedAt: now,
            isNew: false,
            isRemoving: false,
          },
        ]),
      ),
    );
  }, [initialContracts, isInitialLoading]);

  // Clear isNew flag after duration
  useEffect(() => {
    const newContracts = Array.from(streamedContracts.values()).filter((c) => c.isNew);
    if (newContracts.length === 0) return;

    const timeout = setTimeout(() => {
      setStreamedContracts((prev) => {
        const next = new Map(prev);
        for (const [id, contract] of next) {
          if (contract.isNew) {
            next.set(id, { ...contract, isNew: false });
          }
        }
        return next;
      });
    }, newDuration);

    return () => clearTimeout(timeout);
  }, [streamedContracts, newDuration]);

  // Remove contracts after removal animation
  useEffect(() => {
    const removingContracts = Array.from(streamedContracts.values()).filter((c) => c.isRemoving);
    if (removingContracts.length === 0) return;

    const timeout = setTimeout(() => {
      setStreamedContracts((prev) => {
        const next = new Map(prev);
        for (const [id, contract] of next) {
          if (contract.isRemoving) {
            next.delete(id);
          }
        }
        return next;
      });
    }, removeDuration);

    return () => clearTimeout(timeout);
  }, [streamedContracts, removeDuration]);

  // Convert to array for consumers
  const contracts = useMemo(() => Array.from(streamedContracts.values()), [streamedContracts]);

  // Notify on changes
  useEffect(() => {
    onChange?.(contracts);
  }, [contracts, onChange]);

  // Combined loading/error state
  const isLoading = isInitialLoading;
  const isError = isInitialError || isUpdatesError;
  const error = initialError ?? updatesError;

  // Refresh handler
  const refresh = useCallback(() => {
    refetch();
    poll();
  }, [refetch, poll]);

  return {
    contracts,
    count: contracts.filter((c) => !c.isRemoving).length,
    isLoading,
    isPolling,
    isError,
    error,
    connectionStatus,
    // Keep offset as string to preserve precision
    offset: currentOffset ?? initialOffset,
    refresh,
  };
}
