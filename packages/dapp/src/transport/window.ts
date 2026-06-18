/**
 * Window postMessage transport for dApp ↔ Extension communication.
 *
 * Uses window.postMessage for cross-context communication between
 * the injected script (main world) and content script (isolated world).
 */

import { WalletEvent } from "../messages/events.js";
import {
  isSpliceMessageEvent,
  jsonRpcRequest,
  jsonRpcResponse,
  type RequestPayload,
  type ResponsePayload,
} from "../messages/schemas.js";
import { RpcErrorCode, rpcError } from "../rpc/errors.js";
import type { BidirectionalTransport, NotificationListener, TransportOptions } from "./types.js";
import { DEFAULT_TRANSPORT_OPTIONS } from "./types.js";

/**
 * Generate a unique request ID.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

type NotificationFrame = {
  type: WalletEvent.SPLICE_WALLET_REQUEST;
  request: {
    jsonrpc: "2.0";
    method: string;
    params?: unknown;
  };
  target?: string;
};

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === "object" && value !== null;
}

function hasOwn(value: Record<PropertyKey, unknown>, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function parseNotificationFrame(data: unknown): NotificationFrame | undefined {
  if (!isRecord(data) || data.type !== WalletEvent.SPLICE_WALLET_REQUEST) {
    return undefined;
  }

  const request = data.request;
  if (!isRecord(request)) {
    return undefined;
  }

  // The shared request channel uses JSON-RPC id presence as the direction guard:
  // id present is a request, id absent is a wallet-pushed notification.
  if (request.jsonrpc !== "2.0" || typeof request.method !== "string" || hasOwn(request, "id")) {
    return undefined;
  }

  if (hasOwn(data, "target") && typeof data.target !== "string") {
    return undefined;
  }

  return {
    type: WalletEvent.SPLICE_WALLET_REQUEST,
    request: hasOwn(request, "params")
      ? { jsonrpc: "2.0", method: request.method, params: request.params }
      : { jsonrpc: "2.0", method: request.method },
    ...(typeof data.target === "string" ? { target: data.target } : {}),
  };
}

/**
 * Window-based transport using postMessage.
 *
 * Used by the injected provider to communicate with the content script.
 */
export class WindowTransport implements BidirectionalTransport {
  private readonly options: typeof DEFAULT_TRANSPORT_OPTIONS;
  private readonly win: Window;
  private readonly notificationListeners = new Map<symbol, NotificationListener>();
  private notificationMessageListener: ((event: MessageEvent) => void) | undefined;

  constructor(win: Window, options: TransportOptions = {}) {
    this.win = win;
    this.options = { ...DEFAULT_TRANSPORT_OPTIONS, ...options };
  }

  /**
   * Submit an RPC request via postMessage and wait for response.
   */
  async submit(payload: RequestPayload): Promise<ResponsePayload> {
    const id = generateId();
    const request = jsonRpcRequest(id, payload);

    return new Promise((resolve, _reject) => {
      // oxlint-disable-next-line no-console -- debug transport requests
      console.debug("[splice] sending request", { method: payload.method, id });
      const timeoutId = setTimeout(() => {
        this.win.removeEventListener("message", listener);
        // oxlint-disable-next-line no-console -- error visibility for debugging
        console.error("[splice] request timed out", { method: payload.method, id });
        resolve({
          error: rpcError(
            RpcErrorCode.LIMIT_EXCEEDED,
            `Request '${payload.method}' timed out after ${this.options.timeout}ms`,
          ),
        });
      }, this.options.timeout);

      const listener = (event: MessageEvent) => {
        // Validate message structure
        if (!isSpliceMessageEvent(event)) {
          return;
        }

        // Only handle responses
        if (event.data.type !== WalletEvent.SPLICE_WALLET_RESPONSE) {
          return;
        }

        // Match response to request by ID
        if (event.data.response.id !== id) {
          return;
        }

        // Cleanup
        clearTimeout(timeoutId);
        this.win.removeEventListener("message", listener);

        // Extract response payload
        const response = event.data.response;
        // oxlint-disable-next-line no-console -- debug transport responses
        console.debug("[splice] received response", {
          method: payload.method,
          id,
          hasError: "error" in response,
        });
        if ("error" in response) {
          resolve({ error: response.error });
        } else {
          resolve({ result: response.result });
        }
      };

      this.win.addEventListener("message", listener);

      // Send request
      this.win.postMessage(
        {
          type: WalletEvent.SPLICE_WALLET_REQUEST,
          request,
          ...(this.options.target ? { target: this.options.target } : {}),
        },
        this.options.targetOrigin,
      );
    });
  }

  /**
   * Subscribe to id-less JSON-RPC notifications sent over postMessage.
   */
  onNotification(listener: NotificationListener): () => void {
    const subscriptionId = Symbol("notificationListener");
    this.notificationListeners.set(subscriptionId, listener);
    this.installNotificationListener();

    let subscribed = true;
    return () => {
      if (!subscribed) {
        return;
      }
      subscribed = false;
      this.notificationListeners.delete(subscriptionId);
      if (this.notificationListeners.size === 0) {
        this.removeNotificationListener();
      }
    };
  }

  /**
   * Send a wallet-pushed notification via postMessage.
   */
  notify(event: string, payload: unknown, target?: string): void {
    const message: NotificationFrame = {
      type: WalletEvent.SPLICE_WALLET_REQUEST,
      request: {
        jsonrpc: "2.0",
        method: event,
        params: payload,
      },
      ...(target !== undefined ? { target } : {}),
    };

    this.win.postMessage(message, this.options.targetOrigin);
  }

  /**
   * Send a response back via postMessage.
   */
  submitResponse(id: string | number | null, payload: ResponsePayload): void {
    const response = jsonRpcResponse(id, payload);
    this.win.postMessage(
      {
        type: WalletEvent.SPLICE_WALLET_RESPONSE,
        response,
      },
      this.options.targetOrigin,
    );
  }

  private installNotificationListener(): void {
    if (this.notificationMessageListener) {
      return;
    }

    const listener = (event: MessageEvent) => {
      this.handleNotificationEvent(event);
    };
    this.notificationMessageListener = listener;
    this.win.addEventListener("message", listener);
  }

  private removeNotificationListener(): void {
    if (!this.notificationMessageListener) {
      return;
    }

    this.win.removeEventListener("message", this.notificationMessageListener);
    this.notificationMessageListener = undefined;
  }

  private handleNotificationEvent(event: MessageEvent): void {
    const frame = parseNotificationFrame(event.data);
    if (!frame) {
      return;
    }

    if (this.options.target && frame.target && frame.target !== this.options.target) {
      return;
    }

    for (const listener of this.notificationListeners.values()) {
      listener(frame.request.method, frame.request.params, { target: frame.target });
    }
  }
}
