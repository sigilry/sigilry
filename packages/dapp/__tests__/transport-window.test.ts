import { describe, expect, test } from "bun:test";
import { WalletEvent } from "../src/messages/events.js";
import { RpcErrorCode } from "../src/rpc/errors.js";
import { WindowTransport } from "../src/transport/window.js";

type MessageListener = (event: MessageEvent) => void;

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
});
