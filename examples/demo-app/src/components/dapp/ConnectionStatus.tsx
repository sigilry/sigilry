import {
  useAccounts,
  useActiveAccount,
  useCantonProvider,
  useConnect,
  useDisconnect,
} from "@sigilry/react";

import { CopyableText } from "../shared/CopyableText";
import { InfoTooltip } from "../shared/InfoTooltip";
import { StatusPill } from "../shared/StatusPill";
import { docsLinks } from "../../lib/docs";
import { shortenPartyId } from "../../lib/format";
import {
  accountMetadataKey,
  useAccountProviderMetadata,
} from "../../hooks/useAccountProviderMetadata";

export const ConnectionStatus = () => {
  // These hooks are typed wrappers over window.canton RPC:
  // useConnect -> request({ method: "connect" })
  // useDisconnect -> request({ method: "disconnect" })
  const { connectionState, isConnected, isConnecting } = useCantonProvider();
  const { connect, isPending: isConnectingAction, error: connectError } = useConnect();
  const { disconnect, isPending: isDisconnecting } = useDisconnect();
  const { data: accounts } = useAccounts();
  const accountMetadata = useAccountProviderMetadata(accounts, isConnected);
  const { data: activeAccount } = useActiveAccount();
  const statusLabelMap: Record<string, string> = {
    connected: "Connected",
    disconnected: "Disconnected",
    connecting: "Connecting",
    session_expired: "Session expired",
    error: "Error",
  };
  const statusDescriptionMap: Record<string, string> = {
    connected: "The wallet session is active. Commands can be submitted to the Canton ledger.",
    disconnected: "No wallet session. Connect to start interacting with the ledger.",
    connecting: "Waiting for the wallet to approve the connection request.",
    session_expired: "The wallet session has timed out. Reconnect to continue.",
    error: "The connection encountered an error. Check the wallet or try reconnecting.",
  };
  const statusLabel = statusLabelMap[connectionState.status] ?? connectionState.status;
  const statusDescription =
    statusDescriptionMap[connectionState.status] ?? "Current wallet connection state.";
  const statusMessage = isConnected
    ? `Connected to ${activeAccount?.networkId ?? "Canton network"}.`
    : connectionState.status === "connecting"
      ? "Waiting for wallet approval."
      : "Connect to the wallet to start sending commands.";
  const connectionError =
    connectionState.status === "error" ? connectionState.error?.message : null;

  return (
    <>
      <header className="app-header">
        <div className="app-title">
          <p className="eyebrow">Sigilry Demo</p>
          <h1>Canton Todo dApp</h1>
          <p className="subtitle">
            A clear, minimal example of Sigilry React hooks over the Canton network.
          </p>
        </div>
        <div className="connection panel panel-tight">
          <div className="status-row">
            <span className="status-label title-row">
              Status
              <InfoTooltip
                label="Connection status"
                description="Sigilry uses a typed JSON-RPC connect flow to establish a wallet session."
                href={docsLinks.quickStart}
              />
            </span>
            <StatusPill
              status={connectionState.status}
              label={statusLabel}
              description={statusDescription}
              href={docsLinks.rpcProtocol}
            />
          </div>
          <p className="muted small">{statusMessage}</p>
          <div className="button-row">
            <button
              type="button"
              onClick={() => {
                connect();
              }}
              disabled={isConnectingAction || isConnected}
            >
              {isConnectingAction || isConnecting ? "Connecting..." : "Connect wallet"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                disconnect();
              }}
              disabled={!isConnected || isDisconnecting}
            >
              {isDisconnecting ? "Disconnecting..." : "Disconnect"}
            </button>
          </div>
          <div className="stat column">
            <span className="label">Active account</span>
            <span className="value">
              {activeAccount?.partyId ? (
                <CopyableText
                  value={activeAccount.partyId}
                  displayValue={shortenPartyId(activeAccount.partyId)}
                  label="active account party id"
                  textClassName="mono"
                />
              ) : (
                "—"
              )}
            </span>
          </div>
          <p className={connectionError || connectError ? "error" : "error-space"}>
            {connectionError ?? connectError?.message ?? " "}
          </p>
        </div>
      </header>

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="title-row">
              <h2>Accounts</h2>
              <InfoTooltip
                label="Accounts list"
                description="Accounts are fetched with useAccounts and reflect the wallet's current session. Loaded via the useAccounts hook."
                href={docsLinks.react}
              />
            </div>
          </div>
        </div>
        {accounts.length === 0 ? (
          <p className="muted">No accounts loaded yet.</p>
        ) : (
          <ul className="list">
            {accounts.map((account) => (
              <li key={account.partyId}>
                <div className="row">
                  <CopyableText
                    value={account.partyId}
                    displayValue={shortenPartyId(account.partyId)}
                    label="account party id"
                    textClassName="mono"
                  />
                  {activeAccount?.partyId === account.partyId ? (
                    <span className="badge">Active</span>
                  ) : account.primary ? (
                    <span className="badge">Primary</span>
                  ) : null}
                </div>
                <div className="row small muted">
                  <span>{account.networkId}</span>
                  <span>
                    {accountMetadata[accountMetadataKey(account.partyId, account.networkId)]
                      ?.signingProviderId ?? "participant"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
};
