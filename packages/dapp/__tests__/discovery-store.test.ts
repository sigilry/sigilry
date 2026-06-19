import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  announceProvider,
  createDiscoveryStore,
  type DiscoveryStoreListener,
  type SpliceAnnounceDetail,
} from "../src/discovery/index.js";
import type { StatusEvent } from "../src/generated/schemas.js";
import { WalletEvent } from "../src/messages/events.js";
import type { SpliceProvider } from "../src/provider/interface.js";
import { RpcErrorCode } from "../src/rpc/errors.js";

class FakeDiscoveryWindow extends EventTarget {
  canton?: SpliceProvider;
  messages: Array<{ message: unknown; targetOrigin?: string }> = [];

  postMessage(message: unknown, targetOrigin?: string): void {
    this.messages.push({ message, targetOrigin });
  }

  emitMessage(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

const injectedProvider: SpliceProvider = {
  emit: () => false,
  on() {
    return this;
  },
  removeListener() {
    return this;
  },
  request: (async () => {
    throw new Error("injected provider request is not used by discovery store tests");
  }) as SpliceProvider["request"],
};

function makeDetail(overrides: Partial<SpliceAnnounceDetail> = {}): SpliceAnnounceDetail {
  const target = overrides.target ?? "wallet-a";
  return {
    id: target,
    name: "Wallet A",
    icon: "data:image/svg+xml,<svg />",
    target,
    rdns: "com.example.wallet-a",
    uuid: "uuid-wallet-a",
    ...overrides,
  };
}

function statusResult(): StatusEvent {
  return {
    provider: {
      id: "test-wallet",
      providerType: "browser",
    },
    connection: {
      isConnected: false,
      isNetworkConnected: false,
    },
  };
}

function setWindow(win: FakeDiscoveryWindow | undefined): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: win,
    writable: true,
  });
}

function dispatchAnnouncement(detail: SpliceAnnounceDetail): void {
  window.dispatchEvent(new CustomEvent("canton:announceProvider", { detail }));
}

afterEach(() => {
  setWindow(undefined);
});

describe("createDiscoveryStore", () => {
  test("dedupes announced wallets by info.uuid", () => {
    setWindow(new FakeDiscoveryWindow());
    const store = createDiscoveryStore();

    dispatchAnnouncement(makeDetail());
    dispatchAnnouncement(makeDetail({ name: "Wallet A Again" }));

    expect(store.getProviders()).toHaveLength(1);
    expect(store.getProviders()[0].info.uuid).toBe("uuid-wallet-a");
    store.destroy();
  });

  test("findProvider resolves by info.rdns", () => {
    setWindow(new FakeDiscoveryWindow());
    const store = createDiscoveryStore();

    dispatchAnnouncement(makeDetail({ rdns: "com.example.wallet-a" }));

    expect(store.findProvider({ rdns: "com.example.wallet-a" })?.info.name).toBe("Wallet A");
    expect(store.findProvider({ rdns: "com.example.missing" })).toBeUndefined();
    store.destroy();
  });

  test("eager construction discovers a wallet that announced before the store existed", () => {
    setWindow(new FakeDiscoveryWindow());
    const unsubscribeAnnouncement = announceProvider(makeDetail());

    const store = createDiscoveryStore();

    expect(store.getProviders().map((wallet) => wallet.info.rdns)).toEqual([
      "com.example.wallet-a",
    ]);
    store.destroy();
    unsubscribeAnnouncement();
  });

  test("reset clears then re-requests announced providers", () => {
    setWindow(new FakeDiscoveryWindow());
    const unsubscribeAnnouncement = announceProvider(makeDetail());
    const store = createDiscoveryStore();

    store.clear();
    expect(store.getProviders()).toEqual([]);
    store.reset();

    expect(store.getProviders()).toHaveLength(1);
    expect(store.getProviders()[0].info.uuid).toBe("uuid-wallet-a");
    store.destroy();
    unsubscribeAnnouncement();
  });

  test("destroy clears providers and unsubscribes from future announcements", () => {
    setWindow(new FakeDiscoveryWindow());
    const store = createDiscoveryStore();

    dispatchAnnouncement(makeDetail());
    store.destroy();
    dispatchAnnouncement(makeDetail({ uuid: "uuid-wallet-b", rdns: "com.example.wallet-b" }));

    expect(store.getProviders()).toEqual([]);
  });

  test("destroy suppresses the injected fallback", () => {
    const win = new FakeDiscoveryWindow();
    win.canton = injectedProvider;
    setWindow(win);
    const store = createDiscoveryStore();

    expect(store.getProviders()).toHaveLength(1);
    store.destroy();

    expect(store.getProviders()).toEqual([]);
  });

  test("subscribe with emitImmediately emits the current provider set", () => {
    setWindow(new FakeDiscoveryWindow());
    const store = createDiscoveryStore();
    dispatchAnnouncement(makeDetail());
    const listener = mock<DiscoveryStoreListener>(() => {});

    store.subscribe(listener, { emitImmediately: true });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].map((wallet) => wallet.info.uuid)).toEqual(["uuid-wallet-a"]);
    expect(listener.mock.calls[0][1]).toEqual({ added: store.getProviders() });
    store.destroy();
  });

  test("legacy flat details synthesize complete info and dedupe by target-derived uuid", () => {
    setWindow(new FakeDiscoveryWindow());
    const store = createDiscoveryStore();
    const legacyDetail = {
      id: "legacy-wallet",
      name: "Legacy Wallet",
      icon: "data:image/svg+xml,<svg />",
      target: "legacy-wallet",
    } as unknown as SpliceAnnounceDetail;

    dispatchAnnouncement(legacyDetail);
    const [legacyWallet] = store.getProviders();
    dispatchAnnouncement({ ...legacyDetail, name: "Legacy Wallet Again" });

    expect(store.getProviders()).toHaveLength(1);
    expect(legacyWallet.info.rdns).toBe("canton.legacy");
    expect(legacyWallet.info.uuid).toBeString();
    expect(legacyWallet.info.uuid).toBe(store.getProviders()[0].info.uuid);
    store.destroy();
  });

  test("injected fallback surfaces only until an announced provider is observed", () => {
    const win = new FakeDiscoveryWindow();
    win.canton = injectedProvider;
    setWindow(win);
    const store = createDiscoveryStore();

    const [fallback] = store.getProviders();
    expect(store.getProviders()).toHaveLength(1);
    expect(fallback.info.rdns).toBe("canton.injected");
    expect(fallback.getProvider()).toBe(injectedProvider);
    expect(fallback.getProvider({ timeout: 5 })).toBe(injectedProvider);

    dispatchAnnouncement(makeDetail());

    expect(store.getProviders().map((wallet) => wallet.info.rdns)).toEqual([
      "com.example.wallet-a",
    ]);
    store.destroy();
  });

  test("announced wallet getProvider forwards custom timeout to the transport", async () => {
    setWindow(new FakeDiscoveryWindow());
    const store = createDiscoveryStore();
    dispatchAnnouncement(makeDetail({ target: "wallet-timeout" }));

    const [wallet] = store.getProviders();
    const provider = wallet.getProvider({ timeout: 5 });

    await expect(provider.request({ method: "status" })).rejects.toMatchObject({
      code: RpcErrorCode.LIMIT_EXCEEDED,
      message: expect.stringContaining("5ms"),
    });
    store.destroy();
  });

  test("announced wallet getProvider keeps the default timeout when opts are omitted", async () => {
    const win = new FakeDiscoveryWindow();
    setWindow(win);
    const store = createDiscoveryStore();
    dispatchAnnouncement(makeDetail({ target: "wallet-default-timeout" }));

    const [wallet] = store.getProviders();
    const request = wallet.getProvider().request({ method: "status" });
    const message = win.messages[0].message as { request: { id: string | number | null } };

    const earlyResult = await Promise.race([
      request.then(
        () => "settled",
        () => "settled",
      ),
      new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), 10)),
    ]);

    expect(earlyResult).toBe("pending");
    win.emitMessage({
      type: WalletEvent.SPLICE_WALLET_RESPONSE,
      response: {
        jsonrpc: "2.0",
        id: message.request.id,
        result: statusResult(),
      },
    });
    await expect(request).resolves.toEqual(statusResult());
    store.destroy();
  });

  test("announced wallet target overrides caller-supplied transport target", async () => {
    const win = new FakeDiscoveryWindow();
    setWindow(win);
    const store = createDiscoveryStore();
    dispatchAnnouncement(makeDetail({ target: "announced-wallet" }));

    const [wallet] = store.getProviders();
    const request = wallet.getProvider({ target: "caller-target", timeout: 100 }).request({
      method: "status",
    });
    const message = win.messages[0].message as { request: { id: string | number | null } };

    expect(win.messages[0].message).toMatchObject({ target: "announced-wallet" });
    win.emitMessage({
      type: WalletEvent.SPLICE_WALLET_RESPONSE,
      response: {
        jsonrpc: "2.0",
        id: message.request.id,
        result: statusResult(),
      },
    });
    await expect(request).resolves.toEqual(statusResult());
    store.destroy();
  });

  test("clear removes announced providers and leaves the injected fallback visible", () => {
    const win = new FakeDiscoveryWindow();
    win.canton = injectedProvider;
    setWindow(win);
    const store = createDiscoveryStore();
    dispatchAnnouncement(makeDetail());
    const listener = mock<DiscoveryStoreListener>(() => {});
    store.subscribe(listener);

    store.clear();

    expect(store.getProviders().map((wallet) => wallet.info.rdns)).toEqual(["canton.injected"]);
    expect(listener.mock.calls.at(-1)?.[1]?.removed?.map((wallet) => wallet.info.uuid)).toEqual([
      "uuid-wallet-a",
    ]);
    store.destroy();
  });
});
