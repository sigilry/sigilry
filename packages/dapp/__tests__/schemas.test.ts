import { describe, expect, test } from "bun:test";
import {
  CommandIdSchema,
  ConnectResultSchema,
  CreateCommandSchema,
  ExerciseCommandSchema,
  JsCommandsSchema,
  JsPrepareSubmissionRequestSchema,
  ProviderSchema,
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
        provider: {
          id: "send-wallet",
          version: "1.1.0-next.0",
          providerType: "browser" as const,
        },
        connection: {
          isConnected: true,
          isNetworkConnected: true,
        },
        network: {
          networkId: "canton:testnet",
          ledgerApi: "https://api.example.com",
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
        provider: {
          id: "send-wallet",
          providerType: "browser" as const,
        },
        connection: {
          isConnected: false,
          isNetworkConnected: true,
        },
        network: {
          networkId: "canton:testnet",
          accessToken: "jwt-token-here",
        },
      };
      expect(StatusEventSchema.parse(status)).toEqual(status);
    });

    test("validates disconnected status with reason", () => {
      const status = {
        provider: {
          id: "send-wallet",
          providerType: "browser" as const,
        },
        connection: {
          isConnected: false,
          isNetworkConnected: false,
          networkReason: "User disconnected",
        },
      };
      expect(StatusEventSchema.parse(status)).toEqual(status);
    });
  });

  describe("ConnectResultSchema", () => {
    test("validates minimal connected result", () => {
      const result = {
        isConnected: true,
        isNetworkConnected: true,
      };
      expect(ConnectResultSchema.parse(result)).toEqual(result);
    });

    test("validates disconnected result with reasons", () => {
      const result = {
        isConnected: false,
        reason: "No active session",
        isNetworkConnected: false,
        networkReason: "Wallet offline",
      };
      expect(ConnectResultSchema.parse(result)).toEqual(result);
    });
  });

  describe("ProviderSchema", () => {
    test("validates minimal provider info", () => {
      const provider = {
        id: "send-wallet",
        providerType: "browser" as const,
      };
      expect(ProviderSchema.parse(provider)).toEqual(provider);
    });

    test("validates provider info with URL", () => {
      const provider = {
        id: "send-wallet",
        version: "1.1.0-next.0",
        providerType: "remote" as const,
        url: "https://wallet.example.com",
        userUrl: "https://wallet.example.com/approve",
      };
      expect(ProviderSchema.parse(provider)).toEqual(provider);
    });

    test("rejects invalid providerType", () => {
      const provider = {
        id: "send-wallet",
        providerType: "invalid_type",
      };
      expect(() => ProviderSchema.parse(provider)).toThrow();
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

  describe("JsCommandsSchema", () => {
    test("accepts a non-empty array of CIP-0103 command atoms", () => {
      const commands = [
        CreateCommandSchema.parse({
          CreateCommand: {
            templateId: "Ping:Main:Ping",
            createArguments: { sender: "alice" },
          },
        }),
      ];

      expect(JsCommandsSchema.parse(commands)).toEqual(commands);
    });

    test("rejects legacy CreateCommand payload fields", () => {
      expect(() =>
        CreateCommandSchema.parse({
          CreateCommand: {
            templateId: "Ping:Main:Ping",
            payload: { sender: "alice" },
          },
        }),
      ).toThrow();
    });

    test("rejects missing CreateCommand required fields", () => {
      expect(() =>
        CreateCommandSchema.parse({
          CreateCommand: {
            createArguments: { sender: "alice" },
          },
        }),
      ).toThrow();
    });

    test("rejects an object-shaped commands payload", () => {
      expect(() => JsCommandsSchema.parse({ CreateCommand: {} })).toThrow();
    });

    test("rejects an empty commands array", () => {
      expect(() => JsCommandsSchema.parse([])).toThrow();
    });
  });

  describe("JsPrepareSubmissionRequestSchema", () => {
    test("accepts command arrays for prepare submission requests", () => {
      const request = {
        commands: [
          ExerciseCommandSchema.parse({
            ExerciseCommand: {
              templateId: "Ping:Main:Ping",
              contractId: "00deadbeef",
              choice: "Archive",
              choiceArgument: {},
            },
          }),
        ],
      };

      expect(JsPrepareSubmissionRequestSchema.parse(request)).toEqual(request);
    });

    test("rejects legacy ExerciseCommand argument field", () => {
      expect(() =>
        JsPrepareSubmissionRequestSchema.parse({
          commands: [
            {
              ExerciseCommand: {
                templateId: "Ping:Main:Ping",
                contractId: "00deadbeef",
                choice: "Archive",
                argument: {},
              },
            },
          ],
        }),
      ).toThrow();
    });

    test("rejects legacy ExerciseCommand choiceName field", () => {
      expect(() =>
        JsPrepareSubmissionRequestSchema.parse({
          commands: [
            {
              ExerciseCommand: {
                templateId: "Ping:Main:Ping",
                contractId: "00deadbeef",
                choiceName: "Archive",
                choiceArgument: {},
              },
            },
          ],
        }),
      ).toThrow();
    });

    test("rejects ExerciseCommand missing required fields", () => {
      expect(() =>
        JsPrepareSubmissionRequestSchema.parse({
          commands: [
            {
              ExerciseCommand: {
                templateId: "Ping:Main:Ping",
                choice: "Archive",
                choiceArgument: {},
              },
            },
          ],
        }),
      ).toThrow();
    });

    test("rejects non-array commands in prepare submission requests", () => {
      expect(() =>
        JsPrepareSubmissionRequestSchema.parse({
          commands: { ExerciseCommand: {} },
        }),
      ).toThrow();
    });
  });
});
