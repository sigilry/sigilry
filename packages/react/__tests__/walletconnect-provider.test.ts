import { beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * createWalletConnectProvider tests (sigilry#66 review #12, #13).
 *
 * Mocks `@sigilry/dapp/transport` so the test can capture the transport's
 * `onEvent` callback and drive wallet events directly — exercising the event
 * buffer (allowlist + cap), live delivery, on/off, and request error mapping
 * without a live WalletConnect session.
 */
let capturedOnEvent: ((event: string, data: unknown) => void) | undefined;
let submitImpl: (payload: { method: string }) => Promise<unknown>;

mock.module("@sigilry/dapp/transport", () => ({
  WalletConnectTransport: class {
    constructor(cfg: { onEvent?: (event: string, data: unknown) => void }) {
      capturedOnEvent = cfg.onEvent;
    }
    submit(payload: { method: string }) {
      return submitImpl(payload);
    }
  },
}));

const { createWalletConnectProvider } = await import("../src/walletconnect-provider.js");

const cfg = {
  projectId: "p",
  metadata: { name: "d", description: "d", url: "https://d.example.com", icons: [] },
};

beforeEach(() => {
  capturedOnEvent = undefined;
  submitImpl = async () => ({ result: "ok" });
});

describe("createWalletConnectProvider", () => {
  test("buffers a connect-time statusChanged and replays it to a late subscriber", () => {
    const p = createWalletConnectProvider(cfg);
    capturedOnEvent?.("statusChanged", { isConnected: true });
    const seen: unknown[] = [];
    p.on("statusChanged", (d) => seen.push(d));
    expect(seen).toEqual([{ isConnected: true }]);
  });

  test("does NOT buffer transient txChanged when no listener is attached", () => {
    const p = createWalletConnectProvider(cfg);
    capturedOnEvent?.("txChanged", { tx: 1 });
    const seen: unknown[] = [];
    p.on("txChanged", (d) => seen.push(d));
    expect(seen).toEqual([]); // dropped, not retained
  });

  test("the buffer is bounded — only the most recent N are kept", () => {
    const p = createWalletConnectProvider(cfg);
    for (let i = 0; i < 20; i++) capturedOnEvent?.("statusChanged", i);
    const seen: unknown[] = [];
    p.on("statusChanged", (d) => seen.push(d));
    expect(seen).toHaveLength(16); // MAX_BUFFER_PER_EVENT
    expect(seen[0]).toBe(4); // oldest 4 dropped (20 - 16)
    expect(seen.at(-1)).toBe(19);
  });

  test("delivers live to an already-attached listener", () => {
    const p = createWalletConnectProvider(cfg);
    const seen: unknown[] = [];
    p.on("accountsChanged", (d) => seen.push(d));
    capturedOnEvent?.("accountsChanged", [1]);
    expect(seen).toEqual([[1]]);
  });

  test("off() stops delivery", () => {
    const p = createWalletConnectProvider(cfg);
    const seen: unknown[] = [];
    const h = (d: unknown) => seen.push(d);
    p.on("accountsChanged", h);
    p.off("accountsChanged", h);
    capturedOnEvent?.("accountsChanged", [1]);
    expect(seen).toEqual([]);
  });

  test("request returns the transport result and throws transport errors", async () => {
    submitImpl = async (payload) =>
      payload.method === "listAccounts"
        ? { error: { code: 1, message: "kaboom" } }
        : { result: 42 };
    const p = createWalletConnectProvider(cfg);
    expect(await p.request({ method: "status" })).toBe(42);
    await expect(p.request({ method: "listAccounts" })).rejects.toMatchObject({
      message: "kaboom",
    });
  });
});
