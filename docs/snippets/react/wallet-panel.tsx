import { useAccounts, useConnect, useDisconnect } from "@sigilry/react";

export function WalletPanel() {
  const { connect, isPending: isConnecting } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const { data: accounts, isConnected } = useAccounts();

  if (!isConnected) {
    return (
      <button onClick={connect} disabled={isConnecting}>
        {isConnecting ? "Connecting..." : "Connect"}
      </button>
    );
  }

  return (
    <div>
      <button onClick={disconnect} disabled={isDisconnecting}>
        Disconnect
      </button>
      <ul>
        {accounts.map((account) => (
          <li key={account.partyId}>{account.hint}</li>
        ))}
      </ul>
    </div>
  );
}
