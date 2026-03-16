import { describe, expect, test } from "bun:test";
import {
  isSpliceMessage,
  JsonRpcRequest,
  JsonRpcResponse,
  jsonRpcRequest,
  jsonRpcResponse,
  SpliceMessage,
  WalletEvent,
} from "../src/messages/index.js";

describe("Message Schemas", () => {
  describe("WalletEvent enum", () => {
    test("has expected values", () => {
      expect(WalletEvent.SPLICE_WALLET_REQUEST).toBe(WalletEvent.SPLICE_WALLET_REQUEST);
      expect(WalletEvent.SPLICE_WALLET_RESPONSE).toBe(WalletEvent.SPLICE_WALLET_RESPONSE);
      expect(WalletEvent.SPLICE_WALLET_EXT_READY).toBe(WalletEvent.SPLICE_WALLET_EXT_READY);
      expect(WalletEvent.SPLICE_WALLET_EXT_ACK).toBe(WalletEvent.SPLICE_WALLET_EXT_ACK);
      expect(WalletEvent.SPLICE_WALLET_EXT_OPEN).toBe(WalletEvent.SPLICE_WALLET_EXT_OPEN);
      expect(WalletEvent.SPLICE_WALLET_IDP_AUTH_SUCCESS).toBe(
        WalletEvent.SPLICE_WALLET_IDP_AUTH_SUCCESS,
      );
    });
  });

  describe("JsonRpcRequest", () => {
    test("validates request with params object", () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: "123",
        method: "status",
        params: { key: "value" },
      };
      expect(JsonRpcRequest.parse(request)).toEqual(request);
    });

    test("validates request with params array", () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: 1,
        method: "ledgerApi",
        params: ["arg1", "arg2"],
      };
      expect(JsonRpcRequest.parse(request)).toEqual(request);
    });

    test("validates request without params", () => {
      const request = {
        jsonrpc: "2.0" as const,
        id: null,
        method: "connect",
      };
      expect(JsonRpcRequest.parse(request)).toEqual(request);
    });

    test("rejects invalid jsonrpc version", () => {
      const request = {
        jsonrpc: "1.0",
        id: "123",
        method: "status",
      };
      expect(() => JsonRpcRequest.parse(request)).toThrow();
    });
  });

  describe("JsonRpcResponse", () => {
    test("validates success response", () => {
      const response = {
        jsonrpc: "2.0" as const,
        id: "123",
        result: { status: "connected" },
      };
      expect(JsonRpcResponse.parse(response)).toEqual(response);
    });

    test("validates error response", () => {
      const response = {
        jsonrpc: "2.0" as const,
        id: "123",
        error: {
          code: -32601,
          message: "Method not found",
        },
      };
      expect(JsonRpcResponse.parse(response)).toEqual(response);
    });

    test("validates error with data", () => {
      const response = {
        jsonrpc: "2.0" as const,
        id: "123",
        error: {
          code: 4001,
          message: "User Rejected Request",
          data: { reason: "canceled" },
        },
      };
      expect(JsonRpcResponse.parse(response)).toEqual(response);
    });
  });

  describe("SpliceMessage", () => {
    test("validates request message", () => {
      const msg = {
        type: WalletEvent.SPLICE_WALLET_REQUEST as const,
        request: {
          jsonrpc: "2.0" as const,
          id: "123",
          method: "status",
        },
      };
      const parsed = SpliceMessage.parse(msg);
      expect(parsed.type).toBe(WalletEvent.SPLICE_WALLET_REQUEST);
    });

    test("validates response message", () => {
      const msg = {
        type: WalletEvent.SPLICE_WALLET_RESPONSE as const,
        response: {
          jsonrpc: "2.0" as const,
          id: "123",
          result: { connected: true },
        },
      };
      const parsed = SpliceMessage.parse(msg);
      expect(parsed.type).toBe(WalletEvent.SPLICE_WALLET_RESPONSE);
    });

    test("validates ext ready message", () => {
      const msg = { type: WalletEvent.SPLICE_WALLET_EXT_READY as const };
      const parsed = SpliceMessage.parse(msg);
      expect(parsed.type).toBe(WalletEvent.SPLICE_WALLET_EXT_READY);
    });

    test("validates ext ack message", () => {
      const msg = { type: WalletEvent.SPLICE_WALLET_EXT_ACK as const };
      const parsed = SpliceMessage.parse(msg);
      expect(parsed.type).toBe(WalletEvent.SPLICE_WALLET_EXT_ACK);
    });

    test("validates ext open message with URL", () => {
      const msg = {
        type: WalletEvent.SPLICE_WALLET_EXT_OPEN as const,
        url: "https://wallet.example.com/approve?tx=123",
      };
      const parsed = SpliceMessage.parse(msg);
      expect(parsed.type).toBe(WalletEvent.SPLICE_WALLET_EXT_OPEN);
    });

    test("rejects ext open message with invalid URL", () => {
      const msg = {
        type: WalletEvent.SPLICE_WALLET_EXT_OPEN as const,
        url: "not-a-url",
      };
      expect(() => SpliceMessage.parse(msg)).toThrow();
    });

    test("validates IDP auth success message", () => {
      const msg = {
        type: WalletEvent.SPLICE_WALLET_IDP_AUTH_SUCCESS as const,
        token: "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
        sessionId: "session-123",
      };
      const parsed = SpliceMessage.parse(msg);
      expect(parsed.type).toBe(WalletEvent.SPLICE_WALLET_IDP_AUTH_SUCCESS);
    });
  });

  describe("isSpliceMessage", () => {
    test("returns true for valid message", () => {
      expect(isSpliceMessage({ type: WalletEvent.SPLICE_WALLET_EXT_ACK })).toBe(true);
    });

    test("returns false for invalid message", () => {
      expect(isSpliceMessage({ type: "UNKNOWN_EVENT" })).toBe(false);
      expect(isSpliceMessage(null)).toBe(false);
      expect(isSpliceMessage(undefined)).toBe(false);
      expect(isSpliceMessage("string")).toBe(false);
    });
  });

  describe("factory functions", () => {
    test("jsonRpcRequest creates valid request", () => {
      const request = jsonRpcRequest("123", { method: "status" });
      expect(request).toEqual({
        jsonrpc: "2.0",
        id: "123",
        method: "status",
      });
      expect(JsonRpcRequest.parse(request)).toEqual(request);
    });

    test("jsonRpcRequest with params", () => {
      const request = jsonRpcRequest(1, {
        method: "ledgerApi",
        params: { resource: "/v1/query" },
      });
      expect(request).toEqual({
        jsonrpc: "2.0",
        id: 1,
        method: "ledgerApi",
        params: { resource: "/v1/query" },
      });
    });

    test("jsonRpcResponse creates success response", () => {
      const response = jsonRpcResponse("123", { result: { ok: true } });
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: "123",
        result: { ok: true },
      });
      expect(JsonRpcResponse.parse(response)).toEqual(response);
    });

    test("jsonRpcResponse creates error response", () => {
      const response = jsonRpcResponse("123", {
        error: { code: -32601, message: "Method not found" },
      });
      expect(response).toEqual({
        jsonrpc: "2.0",
        id: "123",
        error: { code: -32601, message: "Method not found" },
      });
      expect(JsonRpcResponse.parse(response)).toEqual(response);
    });
  });
});
