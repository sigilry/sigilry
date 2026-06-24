import { beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * WalletConnectTransport tests (sigilry#66 review #11).
 *
 * Mocks `@walletconnect/sign-client` (the relay client) and `fetch` (the direct
 * ledger-api read) so the transport's marshaling + the security/correctness
 * fixes are exercised without a live relay or gateway.
 */

// ── SignClient mock ──────────────────────────────────────────────────
let sessions: Array<{ topic: string; namespaces?: Record<string, { chains?: string[] }> }>;
let statusResult: unknown;
const requests: Array<{ chainId: string; request: { method: string; params: unknown } }> = [];
let handlers: Record<string, ((p: unknown) => void)[]>;

function makeClient() {
  handlers = {};
  return {
    session: { getAll: () => sessions },
    connect: async () => ({
      uri: "wc:fake-uri",
      approval: async () => ({
        topic: "t1",
        namespaces: { canton: { chains: ["canton:devnet"] } },
      }),
    }),
    request: async (args: { chainId: string; request: { method: string; params: unknown } }) => {
      requests.push(args);
      if (args.request.method === "canton_status") return statusResult;
      return { echoed: args.request.method, params: args.request.params };
    },
    disconnect: async () => {},
    on: (event: string, cb: (p: unknown) => void) => {
      (handlers[event] ??= []).push(cb);
    },
  };
}

mock.module("@walletconnect/sign-client", () => ({
  default: { init: async () => makeClient() },
}));

const { WalletConnectTransport } = await import("../src/transport/walletconnect.js");

const baseConfig = {
  projectId: "pid",
  metadata: { name: "Test dApp", description: "d", url: "https://dapp.example.com", icons: [] },
};

beforeEach(() => {
  sessions = [];
  statusResult = {
    provider: { id: "wc", providerType: "remote" },
    connection: { isConnected: true, isNetworkConnected: true },
    network: { ledgerApi: "https://gateway.example.com" },
    session: { accessToken: "tok-123" },
  };
  requests.length = 0;
});

describe("WalletConnectTransport", () => {
  test("status before a session is answered locally (no relay round-trip)", async () => {
    const t = new WalletConnectTransport(baseConfig);
    const res = await t.submit({ method: "status" });
    expect(
      (res as { result: { connection: { isConnected: boolean } } }).result.connection.isConnected,
    ).toBe(false);
    expect(requests).toHaveLength(0);
  });

  test("isConnected returns a ConnectResult, not a bare boolean", async () => {
    const t = new WalletConnectTransport(baseConfig);
    expect(await t.submit({ method: "isConnected" })).toEqual({
      result: { isConnected: false, isNetworkConnected: false },
    });
  });

  test("bare methods marshal onto the canton_* namespace", async () => {
    const t = new WalletConnectTransport(baseConfig);
    await t.submit({ method: "connect" });
    requests.length = 0;
    await t.submit({ method: "signMessage", params: { m: 1 } });
    expect(requests.at(-1)?.request.method).toBe("canton_signMessage");
  });

  test("prepareExecute returns null; prepareExecuteAndWait returns the tx", async () => {
    const t = new WalletConnectTransport(baseConfig);
    await t.submit({ method: "connect" });
    expect(await t.submit({ method: "prepareExecute", params: {} })).toEqual({ result: null });
    const peaw = await t.submit({ method: "prepareExecuteAndWait", params: {} });
    expect((peaw as { result: unknown }).result).toHaveProperty("tx");
  });

  test("restore() ignores a session on a different chain", async () => {
    sessions = [{ topic: "other", namespaces: { canton: { chains: ["canton:mainnet"] } } }];
    const t = new WalletConnectTransport(baseConfig); // configured canton:devnet
    expect(await t.restore()).toBe(false);
  });

  test("restore() adopts a session on the configured chain", async () => {
    sessions = [{ topic: "ok", namespaces: { canton: { chains: ["canton:devnet"] } } }];
    const t = new WalletConnectTransport(baseConfig);
    expect(await t.restore()).toBe(true);
  });

  test("connect refuses an off-allowlist ledgerApi (confused-deputy guard)", async () => {
    const t = new WalletConnectTransport({
      ...baseConfig,
      ledgerApiAllowedOrigins: ["https://trusted.example.com"],
    });
    const res = await t.submit({ method: "connect" });
    expect(res).toHaveProperty("error");
    expect((res as { error: { message: string } }).error.message).toContain("allowlist");
  });

  test("ledgerApi direct read hits the allowed origin with path + query params + bearer", async () => {
    const calls: Array<{ url: string; opts: RequestInit }> = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (url: URL | string, opts: RequestInit) => {
      calls.push({ url: String(url), opts });
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as typeof fetch;
    try {
      const t = new WalletConnectTransport({
        ...baseConfig,
        ledgerApiAllowedOrigins: ["https://gateway.example.com"],
      });
      await t.submit({ method: "connect" });
      const res = await t.submit({
        method: "ledgerApi",
        params: {
          requestMethod: "get",
          resource: "/v2/parties/{party}",
          path: { party: "alice" },
          query: { limit: 5 },
        },
      });
      expect((res as { result: unknown }).result).toEqual({ ok: true });
      const last = calls.at(-1);
      expect(last?.url).toBe("https://gateway.example.com/v2/parties/alice?limit=5");
      const headers = (last?.opts.headers ?? {}) as Record<string, string>;
      expect(headers.authorization).toBe("Bearer tok-123");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("session_delete only disconnects the matching session topic", async () => {
    const t = new WalletConnectTransport({
      ...baseConfig,
      ledgerApiAllowedOrigins: ["https://gateway.example.com"],
    });
    await t.submit({ method: "connect" }); // establishes session topic "t1"

    // Deleting a DIFFERENT session must not disconnect Canton.
    for (const h of handlers.session_delete ?? []) h({ topic: "someone-elses-session" });
    expect(
      ((await t.submit({ method: "isConnected" })) as { result: { isConnected: boolean } }).result
        .isConnected,
    ).toBe(true);

    // Deleting OUR session does.
    for (const h of handlers.session_delete ?? []) h({ topic: "t1" });
    expect(
      ((await t.submit({ method: "isConnected" })) as { result: { isConnected: boolean } }).result
        .isConnected,
    ).toBe(false);
  });
});
