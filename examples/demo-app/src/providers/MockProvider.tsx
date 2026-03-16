/* eslint-disable no-console */

import { SpliceProviderBase } from "@sigilry/dapp/provider";
import type { TypedRequestFn } from "@sigilry/dapp/provider";
import type {
  AccountsChangedEvent,
  JsPrepareSubmissionRequest,
  LedgerApiRequest,
  LedgerApiResult,
  Network,
  PrepareExecuteAndWaitResult,
  SignMessageRequest,
  SignMessageResult,
  StatusEvent,
  TxChangedEvent,
} from "@sigilry/dapp/schemas";

import type { ApprovalQueue } from "../lib/approval-queue";
import { bufferToHex } from "../lib/crypto";
import { callLedgerApi, prepareExecute, prepareExecuteAndWait } from "../lib/ledger-http";
import { createThrottleGate } from "../lib/logging";

const DEFAULT_TX_EVENT: TxChangedEvent = {
  status: "pending",
  commandId: "mock-command",
};

/** Methods that require user approval before execution */
const APPROVAL_REQUIRED_METHODS = new Set([
  "prepareExecute",
  "prepareExecuteAndWait",
  "signMessage",
]);

export interface MockProviderOptions {
  networkId?: string;
  ledgerApiBasePath?: string;
  ledgerUserId?: string;
}

export class MockProvider extends SpliceProviderBase {
  private accounts: AccountsChangedEvent = [];
  private networkId: string;
  private ledgerApiBasePath: string;
  private ledgerUserId: string;
  private lastTxEvent: TxChangedEvent;
  private approvalQueue: ApprovalQueue | null = null;
  private keypair: CryptoKeyPair | null = null;
  private hasKeypair = false;
  private readonly shouldLogRequestError = createThrottleGate(5000);

  constructor(options: MockProviderOptions = {}) {
    super();
    this.networkId = options.networkId ?? "canton:localnet";
    this.ledgerApiBasePath = options.ledgerApiBasePath ?? "/ledger";
    this.ledgerUserId = options.ledgerUserId ?? "ledger-api-user";
    this.lastTxEvent = DEFAULT_TX_EVENT;
  }

  setApprovalQueue(queue: ApprovalQueue): void {
    const shouldLog = this.approvalQueue === null;
    this.approvalQueue = queue;
    if (shouldLog) {
      console.debug("[provider] approval queue attached");
    }
  }

  setKeypair(keypair: CryptoKeyPair | null): void {
    this.keypair = keypair;
    const hasKeypair = Boolean(keypair);
    if (hasKeypair !== this.hasKeypair) {
      this.hasKeypair = hasKeypair;
      console.debug("[provider] keypair set", { hasKeypair });
    }
  }

  setAccounts(accounts: AccountsChangedEvent): void {
    this.accounts = accounts;
    if (this.connected) {
      this.emitAccountsChanged(accounts);
    }
  }

  private async requireApproval(
    method: string,
    params: unknown,
  ): Promise<{ id: string; done: Promise<void> }> {
    if (!this.approvalQueue) {
      throw new Error("Approval queue not configured");
    }
    const approval = this.approvalQueue.addApproval({ method, params });
    console.debug("[provider] approval required", { id: approval.id, method });
    return approval;
  }

  private async signMessage(params: SignMessageRequest): Promise<SignMessageResult> {
    if (!this.keypair?.privateKey) {
      throw new Error("No keypair available for signing");
    }
    const encoder = new TextEncoder();
    const signature = await crypto.subtle.sign(
      "Ed25519",
      this.keypair.privateKey,
      encoder.encode(params.message),
    );
    return { signature: bufferToHex(signature) };
  }

  request: TypedRequestFn = async (payload) => {
    // TypedRequestFn enforces method-specific params/results at compile time.
    // This mock mirrors a wallet extension by handling canonical Sigilry RPC methods.
    let approvalId: string | null = null;
    if (APPROVAL_REQUIRED_METHODS.has(payload.method)) {
      const approval = await this.requireApproval(payload.method, payload.params);
      approvalId = approval.id;
      await approval.done;
    }

    try {
      switch (payload.method) {
        case "status":
          return this.statusEvent();
        case "connect":
          if (!this.connected) {
            console.debug("[provider] connected");
          }
          this.setConnected(true);
          this.emitAccountsChanged();
          return this.statusEvent();
        case "disconnect":
          if (this.connected) {
            console.debug("[provider] disconnected");
          }
          this.setConnected(false);
          return null;
        case "getActiveNetwork":
          return { networkId: this.networkId } satisfies Network;
        case "listAccounts":
          return this.accounts;
        case "getPrimaryAccount": {
          const primary = this.accounts.find((account) => account.primary) ?? this.accounts[0];
          if (!primary) {
            throw new Error("No accounts available");
          }
          return primary;
        }
        case "prepareExecute":
          console.debug("[provider] ledger prepareExecute", {
            commandId: (payload.params as { commandId?: string } | undefined)?.commandId ?? null,
          });
          await prepareExecute(payload.params as JsPrepareSubmissionRequest, {
            basePath: this.ledgerApiBasePath,
            userId: this.ledgerUserId,
          });
          return null;
        case "prepareExecuteAndWait": {
          console.debug("[provider] ledger prepareExecuteAndWait", {
            commandId: (payload.params as { commandId?: string } | undefined)?.commandId ?? null,
          });
          const result = (await prepareExecuteAndWait(
            payload.params as JsPrepareSubmissionRequest,
            {
              basePath: this.ledgerApiBasePath,
              userId: this.ledgerUserId,
            },
          )) as PrepareExecuteAndWaitResult;
          // Return typed results directly (no JSON-RPC envelope).
          if (result?.tx) {
            this.emitTxChanged(result.tx);
          }
          return result;
        }
        case "ledgerApi": {
          const result = (await callLedgerApi(payload.params as LedgerApiRequest, {
            basePath: this.ledgerApiBasePath,
          })) as LedgerApiResult;
          return result;
        }
        case "signMessage":
          console.debug("[provider] signMessage request");
          return this.signMessage(payload.params as SignMessageRequest);
        case "accountsChanged":
          return this.accounts;
        case "txChanged":
          return this.lastTxEvent;
        default:
          throw new Error(`Unsupported method: ${payload.method}`);
      }
    } catch (error) {
      if (approvalId && this.approvalQueue) {
        const message =
          error instanceof Error ? error.message : `Ledger request failed: ${String(error)}`;
        this.approvalQueue.fail(approvalId, message);
      }
      const message = error instanceof Error ? error.message : String(error);
      if (this.shouldLogRequestError(`${payload.method}:${message}`)) {
        console.debug("[provider] request error", { method: payload.method, error });
      }
      throw error;
    }
  };

  emitAccountsChanged(accounts: AccountsChangedEvent = this.accounts): void {
    this.accounts = accounts;
    console.debug("[provider] accountsChanged", {
      count: accounts.length,
      connected: this.connected,
    });
    this.emit("accountsChanged", accounts);
  }

  emitTxChanged(event: TxChangedEvent): void {
    this.lastTxEvent = event;
    this.emit("txChanged", event);
  }

  private statusEvent(): StatusEvent {
    const ledgerApiBaseUrl = this.resolveLedgerApiBaseUrl();
    const event: StatusEvent = {
      kernel: {
        id: "mock-kernel",
        clientType: "browser",
      },
      isConnected: this.connected,
      isNetworkConnected: this.connected,
    };

    if (this.connected) {
      event.network = {
        networkId: this.networkId,
        ledgerApi: {
          baseUrl: ledgerApiBaseUrl,
        },
      };
    }

    return event;
  }

  private resolveLedgerApiBaseUrl(): string {
    if (
      this.ledgerApiBasePath.startsWith("http://") ||
      this.ledgerApiBasePath.startsWith("https://")
    ) {
      return this.ledgerApiBasePath;
    }

    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "http://localhost:5173";
    const path = this.ledgerApiBasePath.startsWith("/")
      ? this.ledgerApiBasePath
      : `/${this.ledgerApiBasePath}`;

    return new URL(path, origin).toString();
  }
}

export function installMockProvider(provider: MockProvider): void {
  (window as { canton?: MockProvider }).canton = provider;
}

export function uninstallMockProvider(): void {
  delete (window as { canton?: MockProvider }).canton;
}
