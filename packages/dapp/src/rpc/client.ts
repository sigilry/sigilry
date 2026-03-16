/**
 * Type-safe RPC client factory for Canton dApp API.
 *
 * Creates a client that validates responses against generated Zod schemas.
 * Used by dApps to communicate with the wallet extension.
 */

import type { RpcMethods } from "../generated/schemas.js";
import type { RpcTransport } from "../transport/types.js";
import { RpcErrorCode } from "./errors.js";

type RpcMethodName = keyof RpcMethods;

/**
 * Canton dApp client interface.
 *
 * All methods return promises that resolve with validated responses
 * or reject with RPC errors.
 */
export interface CantonClient {
  /** Get current wallet status */
  status(): Promise<RpcMethods["status"]["result"]>;

  /** Connect to wallet and get session token */
  connect(): Promise<RpcMethods["connect"]["result"]>;

  /** Disconnect wallet session */
  disconnect(): Promise<RpcMethods["disconnect"]["result"]>;

  /** Get the active network */
  getActiveNetwork(): Promise<RpcMethods["getActiveNetwork"]["result"]>;

  /** List accounts authorized for the dApp */
  listAccounts(): Promise<RpcMethods["listAccounts"]["result"]>;

  /** Get the primary account */
  getPrimaryAccount(): Promise<RpcMethods["getPrimaryAccount"]["result"]>;

  /** Prepare, sign, and execute a transaction */
  prepareExecute(
    params: RpcMethods["prepareExecute"]["params"],
  ): Promise<RpcMethods["prepareExecute"]["result"]>;

  /** Prepare, sign, execute, and wait for transaction completion */
  prepareExecuteAndWait(
    params: RpcMethods["prepareExecuteAndWait"]["params"],
  ): Promise<RpcMethods["prepareExecuteAndWait"]["result"]>;

  /** Sign an arbitrary message */
  signMessage(
    params: RpcMethods["signMessage"]["params"],
  ): Promise<RpcMethods["signMessage"]["result"]>;

  /** Proxy call to Ledger API */
  ledgerApi(params: RpcMethods["ledgerApi"]["params"]): Promise<RpcMethods["ledgerApi"]["result"]>;
}

/**
 * Create a type-safe Canton client with transport and validation.
 *
 * @param transport - RPC transport for sending requests
 * @returns Canton client instance
 */
export function createCantonClient(transport: RpcTransport): CantonClient {
  async function call<M extends RpcMethodName>(
    method: M,
    params?: unknown,
  ): Promise<RpcMethods[M]["result"]> {
    const response = await transport.submit({
      method,
      params: params as Record<string, unknown> | undefined,
    });

    if ("error" in response) {
      throw response.error;
    }

    return response.result as RpcMethods[M]["result"];
  }

  return {
    status: () => call("status"),

    connect: () => call("connect"),

    disconnect: () => call("disconnect"),

    getActiveNetwork: () => call("getActiveNetwork"),

    listAccounts: () => call("listAccounts"),

    getPrimaryAccount: () => call("getPrimaryAccount"),

    prepareExecute: (params) => call("prepareExecute", params),

    prepareExecuteAndWait: (params) => call("prepareExecuteAndWait", params),

    signMessage: (params) => call("signMessage", params),

    ledgerApi: (params) => call("ledgerApi", params),
  };
}

/**
 * RPC client error class for typed error handling.
 */
export class RpcClientError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown,
  ) {
    super(message);
    this.name = "RpcClientError";
  }

  static fromError(error: unknown): RpcClientError {
    if (error instanceof RpcClientError) {
      return error;
    }
    if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
      const rpcErr = error as { code: number; message: string; data?: unknown };
      return new RpcClientError(rpcErr.code, rpcErr.message, rpcErr.data);
    }
    const message = error instanceof Error ? error.message : String(error);
    return new RpcClientError(RpcErrorCode.INTERNAL_ERROR, message);
  }
}
