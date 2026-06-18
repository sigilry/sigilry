import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { WalletEvent } from "../src/messages/events.js";
import { RpcErrorCode } from "../src/rpc/errors.js";
import { WindowTransport } from "../src/transport/window.js";

type MessageListener = (event: MessageEvent) => void;
type Notification1814Fixture = {
  type: WalletEvent.SPLICE_WALLET_REQUEST;
  request: {
    jsonrpc: "2.0";
    method: string;
    params: unknown;
  };
  target: string;
};

const notification1814 = JSON.parse(
  readFileSync(new URL("./fixtures/notification-1814.json", import.meta.url), "utf8"),
) as Notification1814Fixture;

class FakeWindow {
  messages: Array<{ message: unknown; targetOrigin?: string }> = [];
  private listeners = new Map<string, Set<MessageListener>>();

  addEventListener(type: string, listener: MessageListener): void {
    const set = this.listeners.get(type) ?? new Set<MessageListener>();
    set.add(listener);
    this.listeners.set(type, set);
  }

  removeEventListener(type: string, listener: MessageListener): void {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }
    set.delete(listener);
    if (set.size === 0) {
      this.listeners.delete(type);
    }
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
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

describe("WindowTransport", () => {
  test("submit resolves with result on matching response", async () => {
    const win = new FakeWindow();
    const transport = new WindowTransport(win as unknown as Window, {
      timeout: 100,
      targetOrigin: "https://example.com",
      target: "browser:canton",
    });

    const resultPromise = transport.submit({ method: "status" });

    expect(win.messages).toHaveLength(1);
    const message = win.messages[0];
    expect(message.targetOrigin).toBe("https://example.com");
    expect(message.message).toMatchObject({ target: "browser:canton" });

    const request = message.message as { request: { id: string | number | null } };
    const requestId = request.request.id;

    // Wrong id is ignored
    win.emitMessage({
      type: WalletEvent.SPLICE_WALLET_RESPONSE,
      response: { jsonrpc: "2.0", id: "wrong-id", result: { ok: false } },
    });

    // Correct response resolves the promise
    win.emitMessage({
      type: WalletEvent.SPLICE_WALLET_RESPONSE,
      response: { jsonrpc: "2.0", id: requestId, result: { ok: true } },
    });

    const result = await resultPromise;
    expect(result).toEqual({ result: { ok: true } });
  });

  test("submit resolves with error response", async () => {
    const win = new FakeWindow();
    const transport = new WindowTransport(win as unknown as Window, { timeout: 100 });

    const resultPromise = transport.submit({ method: "status" });
    const request = win.messages[0].message as { request: { id: string | number | null } };

    win.emitMessage({
      type: WalletEvent.SPLICE_WALLET_RESPONSE,
      response: {
        jsonrpc: "2.0",
        id: request.request.id,
        error: { code: RpcErrorCode.INTERNAL_ERROR, message: "boom" },
      },
    });

    const result = await resultPromise;
    expect(result).toEqual({
      error: { code: RpcErrorCode.INTERNAL_ERROR, message: "boom" },
    });
  });

  test("submit resolves with timeout error when no response arrives", async () => {
    const win = new FakeWindow();
    const transport = new WindowTransport(win as unknown as Window, { timeout: 5 });

    const result = await transport.submit({ method: "status" });

    expect(result).toMatchObject({
      error: {
        code: RpcErrorCode.LIMIT_EXCEEDED,
        message: expect.stringContaining("timed out"),
      },
    });
  });

  test("submitResponse posts JSON-RPC response message", () => {
    const win = new FakeWindow();
    const transport = new WindowTransport(win as unknown as Window, {
      targetOrigin: "https://example.com",
    });

    transport.submitResponse("1", { result: { ok: true } });

    expect(win.messages).toHaveLength(1);
    expect(win.messages[0]).toEqual({
      message: {
        type: WalletEvent.SPLICE_WALLET_RESPONSE,
        response: {
          jsonrpc: "2.0",
          id: "1",
          result: { ok: true },
        },
      },
      targetOrigin: "https://example.com",
    });
  });

  test("onNotification delivers id-less request frames without submit in flight", () => {
    const win = new FakeWindow();
    const transport = new WindowTransport(win as unknown as Window);
    const notifications: Array<{ method: string; params: unknown; target?: string }> = [];

    transport.onNotification((method, params, meta) => {
      notifications.push({ method, params, target: meta.target });
    });

    win.emitMessage({
      type: WalletEvent.SPLICE_WALLET_REQUEST,
      request: {
        jsonrpc: "2.0",
        method: "txChanged",
        params: { updateId: "update-1" },
      },
      target: "browser:canton",
    });

    expect(notifications).toEqual([
      {
        method: "txChanged",
        params: { updateId: "update-1" },
        target: "browser:canton",
      },
    ]);
  });

  test("onNotification ignores id-carrying request frames", () => {
    const win = new FakeWindow();
    const transport = new WindowTransport(win as unknown as Window);
    const notifications: string[] = [];

    transport.onNotification((method) => {
      notifications.push(method);
    });

    win.emitMessage({
      type: WalletEvent.SPLICE_WALLET_REQUEST,
      request: {
        jsonrpc: "2.0",
        id: "request-1",
        method: "status",
      },
    });

    expect(notifications).toEqual([]);
  });

  test("onNotification filters target mismatches and delivers matching or absent targets", () => {
    const win = new FakeWindow();
    const transport = new WindowTransport(win as unknown as Window, {
      target: "browser:canton",
    });
    const notifications: Array<{ method: string; target?: string }> = [];

    transport.onNotification((method, _params, meta) => {
      notifications.push({ method, target: meta.target });
    });

    win.emitMessage({
      type: WalletEvent.SPLICE_WALLET_REQUEST,
      request: {
        jsonrpc: "2.0",
        method: "txChanged",
      },
      target: "other-wallet",
    });
    win.emitMessage({
      type: WalletEvent.SPLICE_WALLET_REQUEST,
      request: {
        jsonrpc: "2.0",
        method: "accountsChanged",
      },
      target: "browser:canton",
    });
    win.emitMessage({
      type: WalletEvent.SPLICE_WALLET_REQUEST,
      request: {
        jsonrpc: "2.0",
        method: "statusChanged",
      },
    });

    expect(notifications).toEqual([
      { method: "accountsChanged", target: "browser:canton" },
      { method: "statusChanged", target: undefined },
    ]);
  });

  test("onNotification lazily installs and removes the shared message listener", () => {
    const win = new FakeWindow();
    const transport = new WindowTransport(win as unknown as Window);

    expect(win.listenerCount("message")).toBe(0);

    const unsubscribeFirst = transport.onNotification(() => {});
    expect(win.listenerCount("message")).toBe(1);

    const unsubscribeSecond = transport.onNotification(() => {});
    expect(win.listenerCount("message")).toBe(1);

    unsubscribeFirst();
    expect(win.listenerCount("message")).toBe(1);

    unsubscribeSecond();
    expect(win.listenerCount("message")).toBe(0);
  });

  test("notify posts a #1814-compatible id-less request frame", () => {
    const win = new FakeWindow();
    const transport = new WindowTransport(win as unknown as Window, {
      targetOrigin: "https://example.com",
    });

    transport.notify("txChanged", notification1814.request.params, "browser:canton");

    expect(win.messages).toHaveLength(1);
    expect(win.messages[0]).toEqual({
      message: notification1814,
      targetOrigin: "https://example.com",
    });
    expect("id" in (win.messages[0].message as typeof notification1814).request).toBe(false);
  });
});
