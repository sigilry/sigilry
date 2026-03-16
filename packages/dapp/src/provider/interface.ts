/**
 * SpliceProvider interface - the dApp-facing API.
 *
 * This interface matches the reference implementation from splice-wallet-kernel.
 * dApps interact with Canton Network through this interface exposed as `window.canton`.
 */
import type { TypedRequestFn } from "./typed-request.js";

/** Event listener function type */
export type EventListener<T = unknown> = (...args: T[]) => void;

/**
 * SpliceProvider interface for dApp ↔ Wallet communication.
 *
 * Exposed to dApps as `window.canton`. Follows the EIP-1193 style pattern
 * with request/on/emit/removeListener methods.
 */
export interface SpliceProvider {
  /**
   * Send a JSON-RPC request to the wallet.
   *
   * Strictly typed to canonical OpenRPC methods.
   * Use the method name as a literal type to get correct params/result types.
   *
   * @param request - Typed request payload with method and params
   * @returns Promise resolving to the typed method result
   * @throws RPC error if request fails
   *
   * @example
   * // Methods without params
   * const status = await window.canton.request({ method: 'status' })
   * // status is StatusEvent
   *
   * // Methods with params
   * const result = await window.canton.request({
   *   method: 'prepareExecuteAndWait',
   *   params: { commands: {...}, commandId: 'cmd-1' }
   * })
   * // result is PrepareExecuteAndWaitResult
   */
  request: TypedRequestFn;

  /**
   * Subscribe to wallet events.
   *
   * @param event - Event name (e.g., 'accountsChanged', 'txChanged')
   * @param listener - Callback function
   * @returns Provider instance for chaining
   *
   * @example
   * window.canton.on('accountsChanged', (accounts) => console.log(accounts))
   */
  on<T = unknown>(event: string, listener: EventListener<T>): SpliceProvider;

  /**
   * Emit an event to all registered listeners.
   *
   * @param event - Event name
   * @param args - Arguments to pass to listeners
   * @returns true if event had listeners, false otherwise
   */
  emit<T = unknown>(event: string, ...args: T[]): boolean;

  /**
   * Unsubscribe from wallet events.
   *
   * @param event - Event name
   * @param listener - Callback function to remove
   * @returns Provider instance for chaining
   */
  removeListener<T = unknown>(event: string, listener: EventListener<T>): SpliceProvider;
}

/**
 * Extended provider interface with additional methods.
 */
export interface ExtendedSpliceProvider extends SpliceProvider {
  /** Check if provider is connected to the network */
  isConnected(): boolean;

  /** Remove all listeners for an event (or all events) */
  removeAllListeners(event?: string): SpliceProvider;

  /** Get the number of listeners for an event */
  listenerCount(event: string): number;
}
