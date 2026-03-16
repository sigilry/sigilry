import { z } from "zod";
import { AccountsChangedEventSchema, TxChangedEventSchema } from "../generated/schemas.js";

// Extension-only event payload forwarded from the background service worker to the injected provider.
// This is not part of the canonical splice-wallet-kernel `SpliceMessage` protocol.
export const ForwardToInjectedPayloadSchema = z.discriminatedUnion("event", [
  z.object({
    type: z.literal("SPLICE_WALLET_EVENT"),
    event: z.literal("accountsChanged"),
    payload: AccountsChangedEventSchema,
  }),
  z.object({
    type: z.literal("SPLICE_WALLET_EVENT"),
    event: z.literal("txChanged"),
    payload: TxChangedEventSchema,
  }),
]);
export type ForwardToInjectedPayload = z.infer<typeof ForwardToInjectedPayloadSchema>;

export const ApprovalResultSchema = z.object({
  status: z.enum(["approved", "rejected", "timeout", "error"]),
  commandId: z.string(),
  nonce: z.string(),
  signature: z.string().optional(),
  updateId: z.string().optional(),
  completionOffset: z.number().optional(),
  error: z.string().optional(),
});
export type ApprovalResult = z.infer<typeof ApprovalResultSchema>;

export const ApprovalRequestDataSchema = z.object({
  nonce: z.string(),
  commandId: z.string(),
  transactionHash: z.string(),
  preparedTransactionBase64: z.string(),
  origin: z.string(),
  tabId: z.number(),
  createdAt: z.number(),
  expiresAt: z.number(),
  windowId: z.number().optional(),
  // Auth context (REQUIRED - clean break for alpha software)
  accessToken: z.string(),
  partyId: z.string(),
  fingerprint: z.string().optional(), // Optional: may not exist for all parties
  tokenExpiry: z.number(),
  // Signing context - required for popup to derive Canton signing key
  credentialId: z.string().optional(), // WebAuthn credential ID for key derivation
});
export type ApprovalRequestData = z.infer<typeof ApprovalRequestDataSchema>;

export const RuntimeMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("FORWARD_TO_INJECTED"),
    payload: ForwardToInjectedPayloadSchema,
    targetOrigin: z.string(),
  }),
  z.object({
    type: z.literal("DAPP_CONNECTED"),
    origin: z.string(),
    permissions: z.array(z.string()).optional(),
  }),
  z.object({
    type: z.literal("APPROVAL_RESULT"),
    payload: ApprovalResultSchema,
    senderUrl: z.string(),
  }),
  z.object({
    type: z.literal("GET_PENDING_APPROVAL"),
    nonce: z.string(),
  }),
]);
export type RuntimeMessage = z.infer<typeof RuntimeMessageSchema>;

export const ApprovalBridgeRequestSchema = z.object({
  type: z.literal("SPLICE_GET_APPROVAL_REQUEST"),
  nonce: z.string(),
});

export const ApprovalBridgeReadySchema = z.object({
  type: z.literal("SPLICE_APPROVAL_BRIDGE_READY"),
  extensionId: z.string().optional(),
});

export const ApprovalBridgeResultSchema = z.object({
  type: z.literal("SPLICE_APPROVAL_RESULT"),
  payload: ApprovalResultSchema,
});

export const ApprovalBridgeRequestDataMessageSchema = z.object({
  type: z.literal("SPLICE_APPROVAL_REQUEST_DATA"),
  payload: ApprovalRequestDataSchema,
});

export const ApprovalBridgeMessageSchema = z.discriminatedUnion("type", [
  ApprovalBridgeRequestSchema,
  ApprovalBridgeReadySchema,
  ApprovalBridgeResultSchema,
  ApprovalBridgeRequestDataMessageSchema,
]);
export type ApprovalBridgeMessage = z.infer<typeof ApprovalBridgeMessageSchema>;

export type ApprovalBridgeMessageEvent = MessageEvent<ApprovalBridgeMessage>;
export type RuntimeMessageEvent = MessageEvent<RuntimeMessage>;

export function isRuntimeMessage(message: unknown): message is RuntimeMessage {
  return RuntimeMessageSchema.safeParse(message).success;
}

export function isApprovalBridgeMessage(message: unknown): message is ApprovalBridgeMessage {
  return ApprovalBridgeMessageSchema.safeParse(message).success;
}
