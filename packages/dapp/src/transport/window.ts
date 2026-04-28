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
import type { BidirectionalTransport, TransportOptions } from "./types.js";
import { DEFAULT_TRANSPORT_OPTIONS } from "./types.js";

/**
 * Generate a unique request ID.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Window-based transport using postMessage.
 *
 * Used by the injected provider to communicate with the content script.
 */
export class WindowTransport implements BidirectionalTransport {
  private readonly options: typeof DEFAULT_TRANSPORT_OPTIONS;
  private readonly win: Window;

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
}
