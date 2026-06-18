import { afterEach, describe, expect, test } from "bun:test";
import { createProvider, type SpliceAnnounceDetail } from "../src/discovery/index.js";
import { WalletEvent } from "../src/messages/events.js";

type MessageListener = (event: MessageEvent) => void;

class FakeWindow {
  readonly messages: Array<{ message: unknown; targetOrigin?: string }> = [];
  private readonly listeners = new Map<string, Set<MessageListener>>();

  addEventListener(type: string, listener: MessageListener): void {
    const listeners = this.listeners.get(type) ?? new Set<MessageListener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: MessageListener): void {
    const listeners = this.listeners.get(type);
    if (!listeners) {
      return;
    }
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(type);
    }
  }

  postMessage(message: unknown, targetOrigin?: string): void {
    this.messages.push({ message, targetOrigin });
  }

  emitMessage(data: unknown): void {
    const listeners = this.listeners.get("message");
    if (!listeners) {
      return;
    }
    const event = { data } as MessageEvent;
    for (const listener of listeners) {
      listener(event);
    }
  }
}

const detail: SpliceAnnounceDetail = {
  id: "wallet-a",
  name: "Wallet A",
  icon: "data:image/svg+xml,<svg />",
  target: "wallet-a",
  rdns: "com.example.wallet-a",
  uuid: "uuid-wallet-a",
};

function setWindow(win: FakeWindow | undefined): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: win,
    writable: true,
  });
}

function txChangedNotification(target: string): unknown {
  return {
    type: WalletEvent.SPLICE_WALLET_REQUEST,
    request: {
      jsonrpc: "2.0",
      method: "txChanged",
      params: {
        commandId: "command-1",
        status: "pending",
      },
    },
    target,
  };
}

afterEach(() => {
  setWindow(undefined);
});

describe("createProvider", () => {
  test("delivers target-matched id-less notifications to provider listeners", () => {
    const win = new FakeWindow();
    setWindow(win);
    const provider = createProvider(detail);
    const received: unknown[] = [];

    provider.on("txChanged", (event) => {
      received.push(event);
    });
    win.emitMessage(txChangedNotification("other-wallet"));
    win.emitMessage(txChangedNotification("wallet-a"));

    expect(received).toEqual([{ commandId: "command-1", status: "pending" }]);
  });

  test("throws a clear error when constructed outside a browser window", () => {
    setWindow(undefined);

    expect(() => createProvider(detail)).toThrow("createProvider requires a browser window");
  });
});
