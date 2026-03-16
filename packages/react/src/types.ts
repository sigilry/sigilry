/**
 * Core types for @sigilry/react
 *
 * Mirrors the essential types from test-dapp but designed for reuse.
 * Uses discriminated unions to make illegal states unrepresentable.
 */

import type { StatusEvent, TxChangedEvent, Wallet } from "@sigilry/dapp/schemas";

/**
 * Wallet account returned from listAccounts
 */
export type Account = Wallet;

/**
 * Parse party ID into hint and namespace components
 */
export function parsePartyId(partyId: string): { hint: string; namespace: string } {
  const [hint, namespace] = partyId.split("::");
  return { hint: hint ?? partyId, namespace: namespace ?? "" };
}

/**
 * Known error codes from the extension/API
 */
export type KnownErrorCode =
  | "ONBOARDING_INCOMPLETE"
  | "SESSION_EXPIRED"
  | "TOKEN_REFRESH_REQUIRED"
  | "USER_REJECTED"
  | "NOT_CONNECTED"
  | "TIMEOUT"
  | "INTERNAL_ERROR";

/**
 * Action the user can take to resolve an error
 */
export type ErrorAction =
  | { type: "reconnect" }
  | { type: "complete_onboarding" }
  | { type: "retry" }
  | { type: "none" };

/**
 * Parsed error with user-friendly message and suggested action
 */
export interface ParsedError {
  message: string;
  code?: KnownErrorCode | string;
  action: ErrorAction;
  raw?: unknown;
}

/**
 * Parse RPC error into user-friendly format
 */
export function parseError(error: unknown): ParsedError {
  const err = error as { message?: string; code?: number | string; error?: string };
  const message = err?.message ?? err?.error ?? String(error);
  const code = err?.code;

  // Session expired
  if (message.includes("Session expired") || message.includes("session expired")) {
    return {
      message: "Your session has expired",
      code: "SESSION_EXPIRED",
      action: { type: "reconnect" },
      raw: error,
    };
  }

  // Token refresh required
  if (
    message.includes("TOKEN_REFRESH_REQUIRED") ||
    message.includes("Token refresh required") ||
    message.includes("token needs to be refreshed")
  ) {
    return {
      message: "Session token needs refresh. Please disconnect and reconnect.",
      code: "TOKEN_REFRESH_REQUIRED",
      action: { type: "reconnect" },
      raw: error,
    };
  }

  // Onboarding incomplete
  if (
    message.includes("ONBOARDING_INCOMPLETE") ||
    message.includes("onboarding") ||
    message.includes("Canton party not authorized") ||
    message.includes("invalid token")
  ) {
    return {
      message: "Account setup incomplete. Complete onboarding in the wallet app.",
      code: "ONBOARDING_INCOMPLETE",
      action: { type: "complete_onboarding" },
      raw: error,
    };
  }

  // User rejected
  if (code === 4001 || message.includes("rejected")) {
    return {
      message: "Transaction was rejected",
      code: "USER_REJECTED",
      action: { type: "none" },
      raw: error,
    };
  }

  // Not connected
  if (code === 4100 || message.includes("not connected") || message.includes("Unauthorized")) {
    return {
      message: "Not connected to wallet",
      code: "NOT_CONNECTED",
      action: { type: "reconnect" },
      raw: error,
    };
  }

  // Default: internal error with retry
  return {
    message: message.length > 100 ? `${message.slice(0, 100)}...` : message,
    code: typeof code === "string" ? code : "INTERNAL_ERROR",
    action: { type: "retry" },
    raw: error,
  };
}

/**
 * Connection state as discriminated union
 */
export type ConnectionState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; accounts: Account[]; networkId: string }
  | { status: "session_expired"; lastAccounts?: Account[] }
  | { status: "error"; error: ParsedError };

/**
 * Status type for UI display
 */
export type StatusType = "connected" | "disconnected" | "connecting" | "error";

/**
 * Transaction event from extension
 */
export type TxEvent = TxChangedEvent;

/**
 * Canton provider interface (injected by extension)
 */
export interface CantonProvider {
  request: (params: { method: string; params?: unknown }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

/**
 * StatusResult from connect() and status() methods
 */
export type StatusResult = StatusEvent;
