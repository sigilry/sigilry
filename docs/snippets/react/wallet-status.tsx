import { useAccounts, useActiveAccount, useConnect } from "@sigilry/react";

export function WalletStatus() {
  const { connect, isPending } = useConnect();
  const { data: accounts, isConnected } = useAccounts();
  const { data: activeAccount } = useActiveAccount();

  if (!isConnected) {
    return (
      <button onClick={connect} disabled={isPending}>
        {isPending ? "Connecting..." : "Connect"}
      </button>
    );
  }

  return (
    <div>
      <p>Active: {activeAccount?.hint ?? "Unknown"}</p>
      <ul>
        {accounts.map((account) => (
          <li key={account.partyId}>{account.partyId}</li>
        ))}
      </ul>
    </div>
  );
}
