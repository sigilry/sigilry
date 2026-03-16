import { describe, expect, test } from "bun:test";
import {
  createCantonClient,
  createCantonServer,
  createStubHandlers,
  RpcErrorCode,
  rpcError,
} from "../src/rpc/index.js";
import type { RpcTransport } from "../src/transport/types.js";

describe("RPC Client/Server", () => {
  describe("createCantonServer", () => {
    test("routes to correct handler", async () => {
      const server = createCantonServer({
        ...createStubHandlers(),
        status: async () => ({
          kernel: { id: "test", clientType: "browser" },
          isConnected: true,
          isNetworkConnected: true,
        }),
      });

      const result = await server.handleRequest("status", undefined);
      expect(result).toEqual({
        result: {
          kernel: { id: "test", clientType: "browser" },
          isConnected: true,
          isNetworkConnected: true,
        },
      });
    });

    test("returns error for unknown method", async () => {
      const server = createCantonServer(createStubHandlers());
      const result = await server.handleRequest("unknownMethod", undefined);

      expect(result).toHaveProperty("error");
      expect((result as { error: { code: number } }).error.code).toBe(
        RpcErrorCode.METHOD_NOT_FOUND,
      );
    });

    test("catches handler errors", async () => {
      const server = createCantonServer({
        ...createStubHandlers(),
        connect: async () => {
          throw new Error("Connection failed");
        },
      });

      const result = await server.handleRequest("connect", undefined);
      expect(result).toHaveProperty("error");
      expect((result as { error: { message: string } }).error.message).toBe("Connection failed");
    });

    test("passes RPC errors through", async () => {
      const server = createCantonServer({
        ...createStubHandlers(),
        connect: async () => {
          throw rpcError(RpcErrorCode.USER_REJECTED, "User cancelled");
        },
      });

      const result = await server.handleRequest("connect", undefined);
      expect(result).toEqual({
        error: { code: RpcErrorCode.USER_REJECTED, message: "User cancelled" },
      });
    });
  });

  describe("createCantonClient + createCantonServer roundtrip", () => {
    test("successful request/response", async () => {
      const server = createCantonServer({
        ...createStubHandlers(),
        listAccounts: async () => [
          {
            primary: true,
            partyId: "alice::1220abc123",
            status: "allocated",
            hint: "alice",
            publicKey: "ed25519:abc123",
            namespace: "1220abc123",
            networkId: "canton:testnet",
            signingProviderId: "passkey",
          },
        ],
      });

      // Create a transport that routes to server
      const transport: RpcTransport = {
        submit: async (payload) => {
          return server.handleRequest(payload.method, payload.params);
        },
      };

      const client = createCantonClient(transport);
      const result = await client.listAccounts();
      expect(result).toEqual([
        {
          primary: true,
          partyId: "alice::1220abc123",
          status: "allocated",
          hint: "alice",
          publicKey: "ed25519:abc123",
          namespace: "1220abc123",
          networkId: "canton:testnet",
          signingProviderId: "passkey",
        },
      ]);
    });

    test("error propagation", async () => {
      const server = createCantonServer(createStubHandlers());

      const transport: RpcTransport = {
        submit: async (payload) => {
          return server.handleRequest(payload.method, payload.params);
        },
      };

      const client = createCantonClient(transport);
      await expect(client.status()).rejects.toMatchObject({
        code: RpcErrorCode.UNSUPPORTED_METHOD,
      });
    });

    test("ledgerApi with params", async () => {
      const server = createCantonServer({
        ...createStubHandlers(),
        ledgerApi: async (params) => {
          expect(params).toEqual({
            requestMethod: "GET",
            resource: "/v1/query",
          });
          return { response: '{"result": []}' };
        },
      });

      const transport: RpcTransport = {
        submit: async (payload) => {
          return server.handleRequest(payload.method, payload.params);
        },
      };

      const client = createCantonClient(transport);
      const result = await client.ledgerApi({
        requestMethod: "GET",
        resource: "/v1/query",
      });
      expect(result).toEqual({ response: '{"result": []}' });
    });
  });

  describe("createStubHandlers", () => {
    test("all methods throw UNSUPPORTED_METHOD", async () => {
      const handlers = createStubHandlers();
      const methods = [
        "status",
        "connect",
        "disconnect",
        "getActiveNetwork",
        "listAccounts",
        "getPrimaryAccount",
        "prepareExecute",
        "prepareExecuteAndWait",
        "signMessage",
        "ledgerApi",
      ] as const;

      for (const method of methods) {
        await expect(handlers[method](undefined as never)).rejects.toMatchObject({
          code: RpcErrorCode.UNSUPPORTED_METHOD,
        });
      }
    });
  });
});

describe("RPC Errors", () => {
  test("rpcError creates error with code and message", () => {
    const error = rpcError(RpcErrorCode.METHOD_NOT_FOUND, "Unknown method");
    expect(error).toEqual({
      code: -32601,
      message: "Unknown method",
    });
  });

  test("rpcError uses default message if not provided", () => {
    const error = rpcError(RpcErrorCode.INTERNAL_ERROR);
    expect(error.code).toBe(-32603);
    expect(error.message).toBe("Internal error");
  });

  test("rpcError includes data when provided", () => {
    const error = rpcError(RpcErrorCode.INVALID_PARAMS, "Bad params", {
      expected: "string",
      got: "number",
    });
    expect(error).toEqual({
      code: -32602,
      message: "Bad params",
      data: { expected: "string", got: "number" },
    });
  });
});
