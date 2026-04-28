/**
 * JSON-RPC 2.0 error codes and utilities for the CIP-103 dApp API.
 *
 * Standard error codes: https://www.jsonrpc.org/specification#error_object
 * CIP-103 normatively adopts the EIP-1193 provider error allocations (4001/4100/4200/4900/4901)
 * and the EIP-1474 server error range (-32000..-32099) for the Canton dApp API.
 * See: https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md
 */

/** Standard JSON-RPC 2.0 error codes */
export const RpcErrorCode = {
  /** Invalid JSON was received by the server */
  PARSE_ERROR: -32700,
  /** The JSON sent is not a valid Request object */
  INVALID_REQUEST: -32600,
  /** The method does not exist or is not available */
  METHOD_NOT_FOUND: -32601,
  /** Invalid method parameter(s) */
  INVALID_PARAMS: -32602,
  /** Internal JSON-RPC error */
  INTERNAL_ERROR: -32603,

  // CIP-103 provider errors (inherited from EIP-1193)
  /** User rejected the request */
  USER_REJECTED: 4001,
  /** The requested method and/or account has not been authorized by the user */
  UNAUTHORIZED: 4100,
  /** The provider does not support the requested method */
  UNSUPPORTED_METHOD: 4200,
  /** The provider is disconnected from all chains */
  DISCONNECTED: 4900,
  /** The provider is not connected to the requested chain */
  CHAIN_DISCONNECTED: 4901,

  // CIP-103 server errors (inherited from EIP-1474, -32000 to -32099)
  /** Missing or invalid parameters */
  INVALID_INPUT: -32000,
  /** Requested resource not found */
  RESOURCE_NOT_FOUND: -32001,
  /** Requested resource not available */
  RESOURCE_UNAVAILABLE: -32002,
  /** Transaction creation failed */
  TRANSACTION_REJECTED: -32003,
  /** Method is not implemented */
  METHOD_NOT_SUPPORTED: -32004,
  /** Request exceeds defined limit */
  LIMIT_EXCEEDED: -32005,
} as const;

export type RpcErrorCode = (typeof RpcErrorCode)[keyof typeof RpcErrorCode];

/** Create an RPC error object */
export function createRpcError(
  code: RpcErrorCode,
  message: string,
  data?: unknown,
): { code: number; message: string; data?: unknown } {
  return data !== undefined ? { code, message, data } : { code, message };
}

/** Standard error messages */
export const RpcErrorMessage = {
  [RpcErrorCode.PARSE_ERROR]: "Parse error",
  [RpcErrorCode.INVALID_REQUEST]: "Invalid request",
  [RpcErrorCode.METHOD_NOT_FOUND]: "Method not found",
  [RpcErrorCode.INVALID_PARAMS]: "Invalid params",
  [RpcErrorCode.INTERNAL_ERROR]: "Internal error",
  [RpcErrorCode.USER_REJECTED]: "User Rejected Request",
  [RpcErrorCode.UNAUTHORIZED]: "Unauthorized",
  [RpcErrorCode.UNSUPPORTED_METHOD]: "Unsupported Method",
  [RpcErrorCode.DISCONNECTED]: "Disconnected",
  [RpcErrorCode.CHAIN_DISCONNECTED]: "Chain Disconnected",
  [RpcErrorCode.INVALID_INPUT]: "Invalid input",
  [RpcErrorCode.RESOURCE_NOT_FOUND]: "Resource not found",
  [RpcErrorCode.RESOURCE_UNAVAILABLE]: "Resource unavailable",
  [RpcErrorCode.TRANSACTION_REJECTED]: "Transaction rejected",
  [RpcErrorCode.METHOD_NOT_SUPPORTED]: "Method not supported",
  [RpcErrorCode.LIMIT_EXCEEDED]: "Limit exceeded",
} as const;

/** Create a standard error with default message */
export function rpcError(
  code: RpcErrorCode,
  customMessage?: string,
  data?: unknown,
): { code: number; message: string; data?: unknown } {
  const message = customMessage || RpcErrorMessage[code] || "Unknown error";
  return createRpcError(code, message, data);
}

/** Type guard to check if an object is an RPC error */
export function isRpcError(obj: unknown): obj is { code: number; message: string; data?: unknown } {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "code" in obj &&
    typeof (obj as Record<string, unknown>).code === "number" &&
    "message" in obj &&
    typeof (obj as Record<string, unknown>).message === "string"
  );
}
