/**
 * Base implementation of SpliceProvider with event handling.
 *
 * Provides the event emitter functionality. Subclasses implement
 * the `request` method for their specific transport.
 */
import {
  AccountsChangedEventSchema,
  ConnectedEventSchema,
  StatusChangedEventSchema,
  TxChangedEventSchema,
  type ConnectedEvent,
  type StatusChangedEvent,
} from "../generated/schemas.js";
import type { BidirectionalTransport } from "../transport/types.js";
import type { EventListener, ExtendedSpliceProvider, SpliceProvider } from "./interface.js";
import type { TypedRequestFn } from "./typed-request.js";

const providerEventSchemas = {
  accountsChanged: AccountsChangedEventSchema,
  connected: ConnectedEventSchema,
  statusChanged: StatusChangedEventSchema,
  txChanged: TxChangedEventSchema,
} as const;

type ProviderEventMethod = keyof typeof providerEventSchemas;

function isProviderEventMethod(method: string): method is ProviderEventMethod {
  return Object.prototype.hasOwnProperty.call(providerEventSchemas, method);
}

/**
 * Abstract base class for SpliceProvider implementations.
 *
 * Provides event handling (on/emit/removeListener) - subclasses
 * implement the request method for their transport mechanism.
 */
export abstract class SpliceProviderBase implements ExtendedSpliceProvider {
  /** Event listeners by event name */
  protected listeners: Map<string, Set<EventListener>> = new Map();

  /** Connection state */
  protected connected = false;

  private eventTransport: Pick<BidirectionalTransport, "onNotification"> | undefined;
  private unsubscribeFromEventTransport: (() => void) | undefined;

  /**
   * Send a JSON-RPC request. Implemented by subclasses.
   */
  abstract request: TypedRequestFn;

  /**
   * Check if connected to the network.
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Subscribe to an event.
   */
  on<T = unknown>(event: string, listener: EventListener<T>): SpliceProvider {
    const listenerCountBefore = this.totalListenerCount();
    let eventListeners = this.listeners.get(event);
    if (!eventListeners) {
      eventListeners = new Set();
      this.listeners.set(event, eventListeners);
    }
    eventListeners.add(listener as EventListener);
    if (listenerCountBefore === 0 && this.totalListenerCount() > 0) {
      this.subscribeToEventTransport();
    }
    return this;
  }

  /**
   * Emit an event to all listeners.
   */
  emit<T = unknown>(event: string, ...args: T[]): boolean {
    const eventListeners = this.listeners.get(event);
    if (!eventListeners || eventListeners.size === 0) {
      return false;
    }

    for (const listener of eventListeners) {
      try {
        listener(...args);
      } catch (error) {
        // Log but don't throw - one listener shouldn't break others
        // oxlint-disable-next-line no-console -- error visibility for debugging
        console.error(`Error in ${event} listener:`, error);
      }
    }

    return true;
  }

  /**
   * Remove a specific listener.
   */
  removeListener<T = unknown>(event: string, listener: EventListener<T>): SpliceProvider {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener as EventListener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
    this.unsubscribeFromEventTransportIfIdle();
    return this;
  }

  /**
   * Remove all listeners for an event, or all events.
   */
  removeAllListeners(event?: string): SpliceProvider {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    this.unsubscribeFromEventTransportIfIdle();
    return this;
  }

  /**
   * Get the number of listeners for an event.
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /**
   * CIP-103 §4.2.2: emit `connected` after login flow completion.
   *
   * Per spec, `connected` "is only emitted as part of the login flow."
   * Subclasses call this exactly once per successful authentication
   * transition. The payload is a full StatusEvent (identical shape to
   * the `status` RPC result). Updates the internal `connected` flag
   * from `payload.connection.isConnected` so `isConnected()` stays in
   * sync with the broadcast state.
   *
   * For ongoing status transitions after login (network change, session
   * change, server-initiated disconnect), use `emitStatusChanged` instead.
   */
  protected emitConnected(payload: ConnectedEvent): void {
    this.connected = payload.connection.isConnected;
    this.emit("connected", payload);
  }

  /**
   * CIP-103 §4.2.2: emit `statusChanged` for any provider status transition.
   *
   * Covers network change, session change, and disconnect signals — per
   * §4.2.2 (cip-0103.md:216) disconnects flow through this event rather
   * than a separate `disconnect` event. The payload is a full StatusEvent
   * (identical shape to the `status` RPC result). Updates the internal
   * `connected` flag from `payload.connection.isConnected`.
   */
  protected emitStatusChanged(payload: StatusChangedEvent): void {
    this.connected = payload.connection.isConnected;
    this.emit("statusChanged", payload);
  }

  /**
   * Attach a transport notification source without making the base class own
   * transport construction. Concrete providers call this after they have their
   * transport; subscription stays lazy until the first dApp listener exists.
   */
  protected attachEventTransport(transport: Pick<BidirectionalTransport, "onNotification">): void {
    this.unsubscribeFromEventTransport?.();
    this.unsubscribeFromEventTransport = undefined;
    this.eventTransport = transport;
    if (this.totalListenerCount() > 0) {
      this.subscribeToEventTransport();
    }
  }

  private subscribeToEventTransport(): void {
    if (!this.eventTransport || this.unsubscribeFromEventTransport) {
      return;
    }
    this.unsubscribeFromEventTransport = this.eventTransport.onNotification((method, params) => {
      this.emitTransportNotification(method, params);
    });
  }

  private unsubscribeFromEventTransportIfIdle(): void {
    if (this.totalListenerCount() > 0) {
      return;
    }
    this.unsubscribeFromEventTransport?.();
    this.unsubscribeFromEventTransport = undefined;
  }

  private emitTransportNotification(method: string, params: unknown): void {
    if (!isProviderEventMethod(method)) {
      return;
    }
    const parsed = providerEventSchemas[method].safeParse(params);
    if (!parsed.success) {
      return;
    }
    this.emit(method, parsed.data);
  }

  private totalListenerCount(): number {
    let count = 0;
    for (const eventListeners of this.listeners.values()) {
      count += eventListeners.size;
    }
    return count;
  }
}
