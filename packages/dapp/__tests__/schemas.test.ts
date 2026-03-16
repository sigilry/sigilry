import { describe, expect, test } from "bun:test";
import {
  CommandIdSchema,
  KernelInfoSchema,
  StatusEventSchema,
  TxChangedExecutedPayloadSchema,
  WalletSchema,
} from "../src/generated/schemas.js";

describe("Generated Schemas", () => {
  describe("WalletSchema", () => {
    test("validates a complete wallet", () => {
      const wallet = {
        primary: true,
        partyId: "alice::1220abc123",
        status: "allocated" as const,
        hint: "alice",
        publicKey: "ed25519:abc123",
        namespace: "1220abc123",
        networkId: "canton:testnet",
        signingProviderId: "webauthn",
      };
      expect(WalletSchema.parse(wallet)).toEqual(wallet);
    });

    test("validates wallet with optional fields", () => {
      const wallet = {
        primary: false,
        partyId: "bob::1220def456",
        status: "initialized" as const,
        hint: "bob",
        publicKey: "ed25519:def456",
        namespace: "1220def456",
        networkId: "canton:localnet",
        signingProviderId: "passkey",
        externalTxId: "tx-123",
        topologyTransactions: "base64-encoded-data",
        disabled: true,
        reason: "no signing provider matched",
      };
      expect(WalletSchema.parse(wallet)).toEqual(wallet);
    });

    test("rejects wallet with invalid status", () => {
      const wallet = {
        primary: true,
        partyId: "alice::1220abc123",
        status: "invalid_status",
        hint: "alice",
        publicKey: "ed25519:abc123",
        namespace: "1220abc123",
        networkId: "canton:testnet",
        signingProviderId: "webauthn",
      };
      expect(() => WalletSchema.parse(wallet)).toThrow();
    });

    test("rejects wallet missing required fields", () => {
      const wallet = {
        primary: true,
        partyId: "alice::1220abc123",
        // missing other required fields
      };
      expect(() => WalletSchema.parse(wallet)).toThrow();
    });
  });

  describe("StatusEventSchema", () => {
    test("validates connected status with nested network and session", () => {
      const status = {
        kernel: { id: "send-wallet", clientType: "browser" as const },
        isConnected: true,
        isNetworkConnected: true,
        network: {
          networkId: "canton:testnet",
          ledgerApi: { baseUrl: "https://api.example.com" },
        },
        session: {
          accessToken: "jwt-token-here",
          userId: "alice",
        },
      };
      expect(StatusEventSchema.parse(status)).toEqual(status);
    });

    test("validates connected status with network only (no session)", () => {
      const status = {
        kernel: { id: "send-wallet", clientType: "browser" as const },
        isConnected: false,
        isNetworkConnected: true,
        network: {
          networkId: "canton:testnet",
        },
      };
      expect(StatusEventSchema.parse(status)).toEqual(status);
    });

    test("validates disconnected status with reason", () => {
      const status = {
        kernel: { id: "send-wallet", clientType: "browser" as const },
        isConnected: false,
        isNetworkConnected: false,
        networkReason: "User disconnected",
      };
      expect(StatusEventSchema.parse(status)).toEqual(status);
    });
  });

  describe("KernelInfoSchema", () => {
    test("validates minimal kernel info", () => {
      const kernel = {
        id: "send-wallet",
        clientType: "browser" as const,
      };
      expect(KernelInfoSchema.parse(kernel)).toEqual(kernel);
    });

    test("validates kernel info with URL", () => {
      const kernel = {
        id: "send-wallet",
        clientType: "remote" as const,
        url: "https://wallet.example.com",
        userUrl: "https://wallet.example.com/approve",
      };
      expect(KernelInfoSchema.parse(kernel)).toEqual(kernel);
    });

    test("rejects invalid clientType", () => {
      const kernel = {
        id: "send-wallet",
        clientType: "invalid_type",
      };
      expect(() => KernelInfoSchema.parse(kernel)).toThrow();
    });
  });

  describe("TxChangedExecutedPayloadSchema", () => {
    test("validates executed payload", () => {
      const payload = {
        updateId: "update-123",
        completionOffset: 42,
      };
      expect(TxChangedExecutedPayloadSchema.parse(payload)).toEqual(payload);
    });

    test("rejects non-integer completionOffset", () => {
      const payload = {
        updateId: "update-123",
        completionOffset: 42.5,
      };
      expect(() => TxChangedExecutedPayloadSchema.parse(payload)).toThrow();
    });
  });

  describe("CommandIdSchema", () => {
    test("validates command ID", () => {
      const commandId = "cmd-abc123-def456";
      expect(CommandIdSchema.parse(commandId)).toBe(commandId);
    });

    test("rejects non-string", () => {
      expect(() => CommandIdSchema.parse(123)).toThrow();
    });
  });
});
