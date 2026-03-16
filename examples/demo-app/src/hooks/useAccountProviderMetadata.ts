import { useEffect, useMemo, useState } from "react";

import type { Account } from "@sigilry/react";
import { useCantonProvider } from "@sigilry/react";
import { ListAccountsResultSchema } from "@sigilry/dapp/schemas";

export interface AccountProviderMetadata {
  signingProviderId: string;
  externalTxId?: string;
  topologyTransactions?: string;
}

export const accountMetadataKey = (partyId: string, networkId: string): string =>
  `${partyId}::${networkId}`;

const accountDigest = (account: Account): string =>
  [
    account.partyId,
    account.networkId,
    account.status,
    account.primary ? "1" : "0",
    account.disabled ? "1" : "0",
    account.reason ?? "",
  ].join(":");

export type AccountProviderMetadataMap = Record<string, AccountProviderMetadata>;

export function useAccountProviderMetadata(
  accounts: Account[],
  isConnected: boolean,
): AccountProviderMetadataMap {
  const { request } = useCantonProvider();
  const [metadata, setMetadata] = useState<AccountProviderMetadataMap>({});

  const accountsStateDigest = useMemo(
    () => accounts.map(accountDigest).sort().join("|"),
    [accounts],
  );

  useEffect(() => {
    let isActive = true;

    if (!isConnected || accounts.length === 0) {
      setMetadata({});
      return;
    }

    const loadMetadata = async (): Promise<void> => {
      try {
        const raw = await request("listAccounts");
        const parsed = ListAccountsResultSchema.parse(raw);
        if (!isActive) {
          return;
        }

        const nextMetadata: Record<string, AccountProviderMetadata> = {};
        for (const wallet of parsed) {
          nextMetadata[accountMetadataKey(wallet.partyId, wallet.networkId)] = {
            signingProviderId: wallet.signingProviderId,
            externalTxId: wallet.externalTxId,
            topologyTransactions: wallet.topologyTransactions,
          };
        }
        setMetadata(nextMetadata);
      } catch {
        if (isActive) {
          setMetadata({});
        }
      }
    };

    void loadMetadata();

    return () => {
      isActive = false;
    };
  }, [accounts.length, accountsStateDigest, isConnected, request]);

  return metadata;
}
