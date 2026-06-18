import type { SpliceProvider } from "../provider/interface.js";
import { createProvider } from "./create-provider.js";
import type { DiscoveredWallet, SpliceAnnounceDetail } from "./types.js";
import { requestProviders } from "./utils.js";

const LEGACY_RDNS = "canton.legacy";
const INJECTED_RDNS = "canton.injected";

export type DiscoveryStoreMeta = {
  added?: readonly DiscoveredWallet[] | undefined;
  removed?: readonly DiscoveredWallet[] | undefined;
};

export type DiscoveryStoreListener = (
  providers: readonly DiscoveredWallet[],
  meta?: DiscoveryStoreMeta | undefined,
) => void;

export type DiscoveryStore = {
  clear(): void;
  destroy(): void;
  findProvider(args: { rdns: string }): DiscoveredWallet | undefined;
  getProviders(): readonly DiscoveredWallet[];
  reset(): void;
  subscribe(
    listener: DiscoveryStoreListener,
    args?: { emitImmediately?: boolean | undefined } | undefined,
  ): () => void;
};

export type Store = DiscoveryStore;
export type Listener = DiscoveryStoreListener;

function deterministicTargetUuid(target: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < target.length; index += 1) {
    hash ^= target.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `legacy:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function hasCompleteIdentity(detail: SpliceAnnounceDetail): boolean {
  return (
    typeof detail.uuid === "string" &&
    detail.uuid.length > 0 &&
    typeof detail.rdns === "string" &&
    detail.rdns.length > 0
  );
}

function normalizeDetail(detail: SpliceAnnounceDetail): SpliceAnnounceDetail {
  if (hasCompleteIdentity(detail)) {
    return detail;
  }

  return {
    ...detail,
    rdns: LEGACY_RDNS,
    uuid: deterministicTargetUuid(detail.target),
  };
}

function walletFromDetail(detail: SpliceAnnounceDetail): DiscoveredWallet {
  const normalizedDetail = normalizeDetail(detail);
  return {
    info: {
      uuid: normalizedDetail.uuid,
      rdns: normalizedDetail.rdns,
      name: normalizedDetail.name,
      icon: normalizedDetail.icon,
    },
    getProvider: () => createProvider(normalizedDetail),
  };
}

function getInjectedProvider(): SpliceProvider | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.canton;
}

function injectedWallet(): DiscoveredWallet | undefined {
  const provider = getInjectedProvider();
  if (!provider) {
    return undefined;
  }

  return {
    info: {
      uuid: INJECTED_RDNS,
      rdns: INJECTED_RDNS,
      name: "Injected Canton Provider",
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" />',
    },
    getProvider: () => provider,
  };
}

export function createDiscoveryStore(): DiscoveryStore {
  const listeners = new Set<DiscoveryStoreListener>();
  let announcedWallets: readonly DiscoveredWallet[] = [];
  let destroyed = false;

  const getVisibleProviders = (): readonly DiscoveredWallet[] => {
    if (destroyed) {
      return [];
    }
    if (announcedWallets.length > 0) {
      return announcedWallets;
    }
    const fallback = injectedWallet();
    return fallback ? [fallback] : [];
  };

  const emit = (meta?: DiscoveryStoreMeta): void => {
    const providers = getVisibleProviders();
    for (const listener of listeners) {
      listener(providers, meta);
    }
  };

  const request = () =>
    requestProviders((detail) => {
      if (destroyed) {
        return;
      }
      const wallet = walletFromDetail(detail);
      if (announcedWallets.some(({ info }) => info.uuid === wallet.info.uuid)) {
        return;
      }

      announcedWallets = [...announcedWallets, wallet];
      emit({ added: [wallet] });
    });

  let unwatch = request();

  return {
    clear() {
      if (destroyed) {
        return;
      }
      const removed = announcedWallets;
      announcedWallets = [];
      emit({ removed });
    },
    destroy() {
      const removed = announcedWallets;
      announcedWallets = [];
      destroyed = true;
      emit({ removed });
      listeners.clear();
      unwatch?.();
      unwatch = undefined;
    },
    findProvider({ rdns }) {
      return getVisibleProviders().find((wallet) => wallet.info.rdns === rdns);
    },
    getProviders() {
      return getVisibleProviders();
    },
    reset() {
      if (destroyed) {
        return;
      }
      this.clear();
      unwatch?.();
      unwatch = request();
    },
    subscribe(listener, { emitImmediately } = {}) {
      listeners.add(listener);
      if (emitImmediately) {
        const providers = getVisibleProviders();
        listener(providers, { added: providers });
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
