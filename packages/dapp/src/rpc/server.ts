/**
 * Type-safe RPC server factory for Canton dApp API.
 *
 * Creates a server that validates requests and routes to handlers.
 * Used by the extension background script to handle dApp requests.
 */
import { z } from "zod";
import {
  JsPrepareSubmissionRequestSchema,
  LedgerApiRequestSchema,
  SignMessageRequestSchema,
  type RpcMethods,
} from "../generated/schemas.js";
import type { ResponsePayload } from "../messages/schemas.js";
import { RpcErrorCode, rpcError } from "./errors.js";

type RpcMethodName = keyof RpcMethods;

// =============================================================================
// Params Validation Schemas
// =============================================================================

/**
 * Schema for void-param methods.
 * Accepts: undefined, null, or empty array []
 * Rejects: {} or any other value (catches dApp bugs early)
 */
const VoidParamsSchema = z.union([z.undefined(), z.null(), z.array(z.unknown()).length(0)]);

/**
 * Map method names to their params validation schemas.
 */
const paramsSchemaByMethod: Record<RpcMethodName, z.ZodType> = {
  status: VoidParamsSchema,
  connect: VoidParamsSchema,
  disconnect: VoidParamsSchema,
  isConnected: VoidParamsSchema,
  getActiveNetwork: VoidParamsSchema,
  listAccounts: VoidParamsSchema,
  getPrimaryAccount: VoidParamsSchema,
  accountsChanged: VoidParamsSchema,
  txChanged: VoidParamsSchema,
  prepareExecute: JsPrepareSubmissionRequestSchema,
  prepareExecuteAndWait: JsPrepareSubmissionRequestSchema,
  signMessage: SignMessageRequestSchema,
  ledgerApi: LedgerApiRequestSchema,
};

/**
 * Format Zod error issues into a concise message.
 */
function formatZodError(error: z.ZodError): string {
  const issues = error.issues.slice(0, 3); // Limit to first 3 issues
  const formatted = issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
  const suffix = error.issues.length > 3 ? ` (+${error.issues.length - 3} more)` : "";
  return formatted.join("; ") + suffix;
}

/**
 * Handler functions for Canton dApp API methods.
 *
 * Extension implements these handlers to process dApp requests.
 */
export interface CantonServerHandlers {
  status(): Promise<RpcMethods["status"]["result"]>;
  connect(): Promise<RpcMethods["connect"]["result"]>;
  disconnect(): Promise<RpcMethods["disconnect"]["result"]>;
  isConnected(): Promise<RpcMethods["isConnected"]["result"]>;
  getActiveNetwork(): Promise<RpcMethods["getActiveNetwork"]["result"]>;
  listAccounts(): Promise<RpcMethods["listAccounts"]["result"]>;
  getPrimaryAccount(): Promise<RpcMethods["getPrimaryAccount"]["result"]>;
  prepareExecute(
    params: RpcMethods["prepareExecute"]["params"],
  ): Promise<RpcMethods["prepareExecute"]["result"]>;
  prepareExecuteAndWait(
    params: RpcMethods["prepareExecuteAndWait"]["params"],
  ): Promise<RpcMethods["prepareExecuteAndWait"]["result"]>;
  signMessage(
    params: RpcMethods["signMessage"]["params"],
  ): Promise<RpcMethods["signMessage"]["result"]>;
  ledgerApi(params: RpcMethods["ledgerApi"]["params"]): Promise<RpcMethods["ledgerApi"]["result"]>;

  // Event methods are described in the OpenRPC spec but are not invoked via request/response
  // in the window transport; extensions broadcast them via provider events instead.
  accountsChanged?(): Promise<RpcMethods["accountsChanged"]["result"]>;
  txChanged?(): Promise<RpcMethods["txChanged"]["result"]>;
}

export interface CantonServer {
  /** Handle an incoming RPC request */
  handleRequest(method: string, params: unknown): Promise<ResponsePayload>;
}

/**
 * Create a Canton RPC server with handlers.
 *
 * @param handlers - Implementation of Canton API methods
 * @returns Server instance with request handler
 */
export function createCantonServer(handlers: CantonServerHandlers): CantonServer {
  const methodHandlers: Partial<
    Record<RpcMethodName, ((params: unknown) => Promise<unknown>) | undefined>
  > = {
    status: () => handlers.status(),
    connect: () => handlers.connect(),
    disconnect: () => handlers.disconnect(),
    isConnected: () => handlers.isConnected(),
    getActiveNetwork: () => handlers.getActiveNetwork(),
    listAccounts: () => handlers.listAccounts(),
    getPrimaryAccount: () => handlers.getPrimaryAccount(),
    prepareExecute: (params) =>
      handlers.prepareExecute(params as RpcMethods["prepareExecute"]["params"]),
    prepareExecuteAndWait: (params) =>
      handlers.prepareExecuteAndWait(params as RpcMethods["prepareExecuteAndWait"]["params"]),
    signMessage: (params) => handlers.signMessage(params as RpcMethods["signMessage"]["params"]),
    ledgerApi: (params) => handlers.ledgerApi(params as RpcMethods["ledgerApi"]["params"]),
    accountsChanged: handlers.accountsChanged ? () => handlers.accountsChanged!() : undefined,
    txChanged: handlers.txChanged ? () => handlers.txChanged!() : undefined,
  };

  return {
    async handleRequest(method: string, params: unknown): Promise<ResponsePayload> {
      const methodName = method as RpcMethodName;
      const handler = methodHandlers[methodName];

      if (!handler) {
        return {
          error: rpcError(RpcErrorCode.METHOD_NOT_FOUND, `Method '${method}' not found`),
        };
      }

      // Validate params against schema
      const paramsSchema = paramsSchemaByMethod[methodName];
      const parseResult = paramsSchema.safeParse(params);

      if (!parseResult.success) {
        return {
          error: rpcError(
            RpcErrorCode.INVALID_PARAMS,
            `Invalid params for '${method}': ${formatZodError(parseResult.error)}`,
          ),
        };
      }

      try {
        // Use validated params (for void methods, parseResult.data is undefined/null/[])
        const result = await handler(parseResult.data);
        return { result };
      } catch (error) {
        // If error is already an RPC error, pass it through
        if (typeof error === "object" && error !== null && "code" in error && "message" in error) {
          return { error: error as { code: number; message: string } };
        }

        // Wrap other errors
        const message = error instanceof Error ? error.message : String(error);
        return {
          error: rpcError(RpcErrorCode.INTERNAL_ERROR, message),
        };
      }
    },
  };
}

/**
 * Create stub handlers that throw "not implemented" errors.
 * Useful for incremental implementation.
 */
export function createStubHandlers(): CantonServerHandlers {
  const notImplemented = (method: string) => async () => {
    throw rpcError(RpcErrorCode.UNSUPPORTED_METHOD, `${method} not implemented`);
  };

  return {
    status: notImplemented("status"),
    connect: notImplemented("connect"),
    disconnect: notImplemented("disconnect"),
    isConnected: notImplemented("isConnected"),
    getActiveNetwork: notImplemented("getActiveNetwork"),
    listAccounts: notImplemented("listAccounts"),
    getPrimaryAccount: notImplemented("getPrimaryAccount"),
    prepareExecute: notImplemented("prepareExecute"),
    prepareExecuteAndWait: notImplemented("prepareExecuteAndWait"),
    signMessage: notImplemented("signMessage"),
    ledgerApi: notImplemented("ledgerApi"),
  };
}
