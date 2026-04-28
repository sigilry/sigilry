/**
 * Zod schemas for dApp ↔ Extension message validation.
 *
 * These schemas validate postMessage payloads exchanged between
 * the injected provider and content script.
 */
import { z } from "zod";
import { WalletEvent } from "./events.js";

// =============================================================================
// JSON-RPC Types
// =============================================================================

export const RequestPayload = z.object({
  method: z.string(),
  params: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
});
export type RequestPayload = z.infer<typeof RequestPayload>;

export const SuccessResponse = z
  .object({
    result: z.unknown().optional(),
  })
  .passthrough();
export type SuccessResponse = z.infer<typeof SuccessResponse>;

export const RpcError = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type RpcError = z.infer<typeof RpcError>;

export const ErrorResponse = z
  .object({
    error: RpcError,
  })
  .passthrough();
export type ErrorResponse = z.infer<typeof ErrorResponse>;

export const ResponsePayload = z.union([SuccessResponse, ErrorResponse]);
export type ResponsePayload = z.infer<typeof ResponsePayload>;

export const JsonRpcMeta = z.object({
  jsonrpc: z.literal("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
});
export type JsonRpcMeta = z.infer<typeof JsonRpcMeta>;

export const JsonRpcRequest = JsonRpcMeta.merge(RequestPayload);
export type JsonRpcRequest = z.infer<typeof JsonRpcRequest>;

/** JSON-RPC 2.0 success response */
export const JsonRpcSuccessResponse = JsonRpcMeta.merge(SuccessResponse);
export type JsonRpcSuccessResponse = z.infer<typeof JsonRpcSuccessResponse>;

/** JSON-RPC 2.0 error response */
export const JsonRpcErrorResponse = JsonRpcMeta.merge(ErrorResponse);
export type JsonRpcErrorResponse = z.infer<typeof JsonRpcErrorResponse>;

/** JSON-RPC 2.0 response (success or error) */
export const JsonRpcResponse = z.union([JsonRpcSuccessResponse, JsonRpcErrorResponse]);
export type JsonRpcResponse = z.infer<typeof JsonRpcResponse>;

// =============================================================================
// Extension Messages
// =============================================================================

const SpliceTarget = z
  .string()
  .min(1)
  .describe(
    "Optional routing key for browser-extension messaging. When present, only the matching extension should handle the message.",
  );

/** Message containing a JSON-RPC request from dApp to extension */
export const SpliceWalletRequestMessage = z.object({
  type: z.literal(WalletEvent.SPLICE_WALLET_REQUEST),
  request: JsonRpcRequest,
  target: SpliceTarget.optional(),
});
export type SpliceWalletRequestMessage = z.infer<typeof SpliceWalletRequestMessage>;

/** Message containing a JSON-RPC response from extension to dApp */
export const SpliceWalletResponseMessage = z.object({
  type: z.literal(WalletEvent.SPLICE_WALLET_RESPONSE),
  response: JsonRpcResponse,
});
export type SpliceWalletResponseMessage = z.infer<typeof SpliceWalletResponseMessage>;

/** dApp discovery message - "is extension loaded?" */
export const SpliceWalletExtReadyMessage = z.object({
  type: z.literal(WalletEvent.SPLICE_WALLET_EXT_READY),
  target: SpliceTarget.optional(),
});
export type SpliceWalletExtReadyMessage = z.infer<typeof SpliceWalletExtReadyMessage>;

/** Extension acknowledgment - "yes, I'm ready" */
export const SpliceWalletExtAckMessage = z.object({
  type: z.literal(WalletEvent.SPLICE_WALLET_EXT_ACK),
  target: SpliceTarget.optional(),
});
export type SpliceWalletExtAckMessage = z.infer<typeof SpliceWalletExtAckMessage>;

/** Request to open wallet UI at a specific URL */
export const SpliceWalletExtOpenMessage = z.object({
  type: z.literal(WalletEvent.SPLICE_WALLET_EXT_OPEN),
  url: z.string().url(),
  target: SpliceTarget.optional(),
});
export type SpliceWalletExtOpenMessage = z.infer<typeof SpliceWalletExtOpenMessage>;

/** IDP auth success notification with token */
export const SpliceWalletIdpAuthSuccessMessage = z.object({
  type: z.literal(WalletEvent.SPLICE_WALLET_IDP_AUTH_SUCCESS),
  token: z.string(),
  sessionId: z.string(),
});
export type SpliceWalletIdpAuthSuccessMessage = z.infer<typeof SpliceWalletIdpAuthSuccessMessage>;

// =============================================================================
// Union Type
// =============================================================================

/** Discriminated union of all message types */
export const SpliceMessage = z.discriminatedUnion("type", [
  SpliceWalletRequestMessage,
  SpliceWalletResponseMessage,
  SpliceWalletExtReadyMessage,
  SpliceWalletExtAckMessage,
  SpliceWalletExtOpenMessage,
  SpliceWalletIdpAuthSuccessMessage,
]);
export type SpliceMessage = z.infer<typeof SpliceMessage>;

// =============================================================================
// Type Guards
// =============================================================================

export type SpliceMessageEvent = MessageEvent<SpliceMessage>;

/** Type guard for SpliceMessageEvent */
export function isSpliceMessageEvent(event: unknown): event is SpliceMessageEvent {
  if (typeof event === "object" && event !== null && "data" in event) {
    return isSpliceMessage((event as MessageEvent).data);
  }
  return false;
}

/** Type guard for SpliceMessage */
export function isSpliceMessage(message: unknown): message is SpliceMessage {
  return SpliceMessage.safeParse(message).success;
}

// =============================================================================
// Factory Functions
// =============================================================================

/** Create a JSON-RPC request object */
export function jsonRpcRequest(
  id: string | number | null,
  payload: RequestPayload,
): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id,
    ...payload,
  };
}

/** Create a JSON-RPC response object */
export function jsonRpcResponse(
  id: string | number | null,
  payload: ResponsePayload,
): JsonRpcResponse {
  return {
    jsonrpc: "2.0",
    id,
    ...payload,
  };
}
