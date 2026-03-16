/**
 * Transport abstraction for RPC communication.
 *
 * Transports handle the actual message delivery between dApp and extension.
 */
import type { RequestPayload, ResponsePayload } from "../messages/schemas.js";

/**
 * RPC transport interface.
 *
 * Implementations handle the communication mechanism (postMessage, HTTP, etc.)
 */
export interface RpcTransport {
  /**
   * Submit an RPC request and wait for response.
   *
   * @param payload - Request payload with method and params
   * @returns Promise resolving to success or error response
   */
  submit(payload: RequestPayload): Promise<ResponsePayload>;
}

/**
 * Bidirectional transport that can also receive messages.
 */
export interface BidirectionalTransport extends RpcTransport {
  /**
   * Send a response back to the requester.
   *
   * @param id - Request ID to respond to
   * @param payload - Response payload
   */
  submitResponse(id: string | number | null, payload: ResponsePayload): void;
}

/**
 * Transport configuration options.
 */
export interface TransportOptions {
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Origin to accept messages from (for postMessage) */
  targetOrigin?: string;
}

/** Default transport options */
// TODO: Before production, implement origin validation to restrict targetOrigin
// to trusted domains (e.g., https only). Current '*' allows any origin.
export const DEFAULT_TRANSPORT_OPTIONS: Required<TransportOptions> = {
  timeout: 30000, // 30 seconds
  targetOrigin: "*",
};
