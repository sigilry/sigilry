import { afterEach, describe, expect, mock, test } from "bun:test";
import {
  announceProvider,
  createDiscoveryStore,
  type DiscoveryStoreListener,
  type SpliceAnnounceDetail,
} from "../src/discovery/index.js";
import type { SpliceProvider } from "../src/provider/interface.js";

class FakeDiscoveryWindow extends EventTarget {
  canton?: SpliceProvider;
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

    dispatchAnnouncement(makeDetail());

    expect(store.getProviders().map((wallet) => wallet.info.rdns)).toEqual([
      "com.example.wallet-a",
    ]);
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
