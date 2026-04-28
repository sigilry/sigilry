import { useMemo } from "react";
import { useActiveAccount, useActiveContracts, useConnect } from "@sigilry/react";

import { StatusPill } from "../../components/shared/StatusPill";
import { shortenContractId, shortenPartyId, shortenTemplateId } from "../../lib/format";

interface ContractsByTemplate {
  templateId: string;
  contracts: ReturnType<typeof useActiveContracts>["data"];
}

export const ActiveContractsExample = () => {
  const {
    connect,
    isPending: isConnectPending,
    isError: isConnectError,
    error: connectError,
  } = useConnect();
  const activeAccount = useActiveAccount();
  // `.rl/audit/GIST-MAPPING.md` verified that the current React hook surface models the
  // gist's wildcard `cumulative: []` query by omitting `templateFilter` entirely.
  const activeContracts = useActiveContracts();

  const groupedContracts = useMemo<ContractsByTemplate[]>(() => {
    const contractsByTemplate = new Map<string, ContractsByTemplate["contracts"]>();

    for (const contract of activeContracts.data) {
      const existing = contractsByTemplate.get(contract.templateId);
      if (existing) {
        existing.push(contract);
        continue;
      }
      contractsByTemplate.set(contract.templateId, [contract]);
    }

    return [...contractsByTemplate.entries()]
      .map(([templateId, contracts]) => ({ templateId, contracts }))
      .sort((left, right) => left.templateId.localeCompare(right.templateId));
  }, [activeContracts.data]);

  const connectionStatus = activeAccount.isConnected
    ? "connected"
    : isConnectPending
      ? "connecting"
      : isConnectError
        ? "error"
        : "disconnected";
  const contractCount = activeContracts.data.length;
  const templateCount = groupedContracts.length;

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Connect State</h3>
            <p className="muted">
              Mirrors the browser-console flow with `useConnect` and `useActiveAccount`.
            </p>
          </div>
          <StatusPill
            status={connectionStatus}
            label={connectionStatus.replace("_", " ")}
            description="Connection state is derived from the React provider instead of direct RPC calls."
          />
        </div>
        <div className="stat">
          <span className="label">Party ID</span>
          <span className="value mono" title={activeAccount.partyId ?? undefined}>
            {activeAccount.partyId ? shortenPartyId(activeAccount.partyId) : "Not connected"}
          </span>
        </div>
        {!activeAccount.isConnected ? (
          <div className="button-row">
            <button type="button" onClick={connect} disabled={isConnectPending}>
              {isConnectPending ? "Connecting..." : "Connect wallet"}
            </button>
          </div>
        ) : null}
        {connectError ? <p className="error">{connectError.message}</p> : null}
        {activeAccount.error ? <p className="error">{activeAccount.error.message}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Counts</h3>
            <p className="muted">
              Wildcard active-contracts query across every template visible to the active party.
            </p>
          </div>
          <span className="count-pill">{contractCount} contracts</span>
        </div>
        <div className="stat">
          <span className="label">Templates</span>
          <span className="value">{templateCount}</span>
        </div>
        <div className="stat">
          <span className="label">Contracts</span>
          <span className="value">{contractCount}</span>
        </div>
        {activeContracts.isLoading ? <p className="muted">Loading active contracts...</p> : null}
        {activeContracts.error ? <p className="error">{activeContracts.error.message}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Contracts By Template</h3>
            <p className="muted">
              The list mirrors the gist's `byTemplate` grouping, but renders as accessible React UI.
            </p>
          </div>
        </div>
        {activeAccount.isConnected && !activeContracts.isLoading && contractCount === 0 ? (
          <p className="muted">No active contracts are currently visible for this party.</p>
        ) : null}
        {!activeAccount.isConnected ? (
          <p className="muted">Connect a wallet to load ledger data.</p>
        ) : null}
        {groupedContracts.map(({ templateId, contracts }) => (
          <details key={templateId}>
            <summary>
              <span className="mono" title={templateId}>
                {shortenTemplateId(templateId)}
              </span>{" "}
              ({contracts.length})
            </summary>
            <ul className="list" style={{ marginTop: "0.75rem" }}>
              {contracts.map((contract) => (
                <li key={contract.contractId}>
                  <div className="row">
                    <span className="mono" title={contract.contractId}>
                      {shortenContractId(contract.contractId)}
                    </span>
                    {contract.createdAt ? (
                      <span className="small muted">
                        {new Date(contract.createdAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </section>
    </div>
  );
};
