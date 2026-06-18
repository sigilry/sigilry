import { afterEach, describe, expect, test } from "bun:test";
import {
  announceProvider,
  requestProviders,
  type SpliceAnnounceDetail,
} from "../src/discovery/index.js";

class FakeDiscoveryWindow extends EventTarget {
  readonly dispatchedEvents: string[] = [];

  override dispatchEvent(event: Event): boolean {
    this.dispatchedEvents.push(event.type);
    return super.dispatchEvent(event);
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

function setWindow(win: FakeDiscoveryWindow | undefined): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: win,
    writable: true,
  });
}

afterEach(() => {
  setWindow(undefined);
});

describe("discovery utils", () => {
  test("requestProviders subscribes before dispatching requestProvider", () => {
    const win = new FakeDiscoveryWindow();
    setWindow(win);
    const received: SpliceAnnounceDetail[] = [];

    win.addEventListener("canton:requestProvider", () => {
      win.dispatchEvent(new CustomEvent("canton:announceProvider", { detail }));
    });

    const unsubscribe = requestProviders((announcedDetail) => {
      received.push(announcedDetail);
    });

    expect(received).toEqual([detail]);
    expect(win.dispatchedEvents).toContain("canton:requestProvider");
    unsubscribe?.();
  });

  test("requestProviders is an SSR no-op", () => {
    setWindow(undefined);

    expect(requestProviders(() => {})).toBeUndefined();
  });

  test("announceProvider dispatches immediately and re-dispatches on requestProvider", () => {
    const win = new FakeDiscoveryWindow();
    setWindow(win);
    const received: SpliceAnnounceDetail[] = [];

    win.addEventListener("canton:announceProvider", (event) => {
      received.push((event as CustomEvent<SpliceAnnounceDetail>).detail);
    });

    const unsubscribe = announceProvider(detail);
    win.dispatchEvent(new CustomEvent("canton:requestProvider"));
    unsubscribe();
    win.dispatchEvent(new CustomEvent("canton:requestProvider"));

    expect(received).toEqual([detail, detail]);
    expect(Object.isFrozen(received[0])).toBe(true);
  });
});
