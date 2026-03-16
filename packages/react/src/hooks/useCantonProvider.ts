/**
 * useCantonProvider - Hook for accessing Canton provider state
 *
 * Re-exports useCanton for backward compatibility and discoverability.
 * Follows wagmi patterns.
 */

import { type CantonContextValue, useCanton } from "../context";

export type UseCantonProviderResult = CantonContextValue;

/**
 * Hook for accessing Canton provider state and actions
 *
 * This is an alias for useCanton() for API discoverability.
 *
 * @example
 * ```tsx
 * function WalletStatus() {
 *   const { isConnected, partyId, connect, disconnect } = useCantonProvider()
 *
 *   if (!isConnected) {
 *     return <button onClick={connect}>Connect</button>
 *   }
 *
 *   return (
 *     <div>
 *       <p>Connected: {partyId}</p>
 *       <button onClick={disconnect}>Disconnect</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useCantonProvider(): UseCantonProviderResult {
  return useCanton();
}
