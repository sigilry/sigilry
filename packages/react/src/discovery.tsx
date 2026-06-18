import type { DiscoveredWallet, DiscoveryStore } from "@sigilry/dapp/discovery";
import { createDiscoveryStore } from "@sigilry/dapp/discovery";
import type { HTMLAttributes, ReactNode } from "react";
import { useSyncExternalStore } from "react";

const EMPTY_WALLETS: readonly DiscoveredWallet[] = Object.freeze([]);

type DiscoverySingleton = {
  store: DiscoveryStore;
  snapshot: readonly DiscoveredWallet[];
};

let discoverySingleton: DiscoverySingleton | undefined;

function sameWalletSnapshot(
  previous: readonly DiscoveredWallet[],
  next: readonly DiscoveredWallet[],
): boolean {
  if (previous.length !== next.length) {
    return false;
  }

  return previous.every((wallet, index) => wallet.info.uuid === next[index]?.info.uuid);
}

function commitSnapshot(
  singleton: DiscoverySingleton,
  next: readonly DiscoveredWallet[],
): readonly DiscoveredWallet[] {
  if (!sameWalletSnapshot(singleton.snapshot, next)) {
    singleton.snapshot = next;
  }

  return singleton.snapshot;
}

function getDiscoverySingleton(): DiscoverySingleton | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  if (!discoverySingleton) {
    discoverySingleton = {
      store: createDiscoveryStore(),
      snapshot: EMPTY_WALLETS,
    };
  }

  return discoverySingleton;
}

function getDiscoverySnapshot(): readonly DiscoveredWallet[] {
  const singleton = getDiscoverySingleton();
  if (!singleton) {
    return EMPTY_WALLETS;
  }

  return commitSnapshot(singleton, singleton.store.getProviders());
}

export function getDiscoveryServerSnapshot(): readonly DiscoveredWallet[] {
  return EMPTY_WALLETS;
}

function subscribeToDiscovery(onStoreChange: () => void): () => void {
  const singleton = getDiscoverySingleton();
  if (!singleton) {
    return () => {};
  }

  return singleton.store.subscribe(
    (wallets) => {
      commitSnapshot(singleton, wallets);
      onStoreChange();
    },
    { emitImmediately: true },
  );
}

export function useDiscovery(): readonly DiscoveredWallet[] {
  return useSyncExternalStore(
    subscribeToDiscovery,
    getDiscoverySnapshot,
    getDiscoveryServerSnapshot,
  );
}

export type WalletPickerProps = Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> & {
  wallets: readonly DiscoveredWallet[];
  onSelect: (wallet: DiscoveredWallet) => void;
  emptyState?: ReactNode;
};

export function WalletPicker({
  wallets,
  onSelect,
  emptyState = "No wallets found",
  ...props
}: WalletPickerProps): ReactNode {
  return (
    <div {...props}>
      {wallets.length === 0 ? (
        <p>{emptyState}</p>
      ) : (
        wallets.map((wallet) => (
          <button
            aria-label={wallet.info.name}
            key={wallet.info.uuid}
            onClick={() => onSelect(wallet)}
            type="button"
          >
            <img alt={wallet.info.name} src={wallet.info.icon} />
            <span>{wallet.info.name}</span>
          </button>
        ))
      )}
    </div>
  );
}
