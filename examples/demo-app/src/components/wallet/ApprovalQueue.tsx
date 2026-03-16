import React from "react";

import { useWalletSimulator } from "../../hooks/useWalletSimulator";
import { ApprovalCard } from "./ApprovalCard";
import { InfoTooltip } from "../shared/InfoTooltip";
import { docsLinks } from "../../lib/docs";

export const ApprovalQueue = () => {
  const { approvalQueue, isGenerating } = useWalletSimulator();
  const approvals = approvalQueue.pending;
  const pendingCount = approvals.filter((approval) => approval.status === "pending").length;

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <div className="title-row">
            <h3>Approvals</h3>
            <InfoTooltip
              label="Approval queue"
              description="Sigilry routes commands to the wallet for explicit user approval before submission. Every ledger command requires wallet approval."
              href={docsLinks.demoApp}
            />
          </div>
        </div>
        <span className="count-pill">{pendingCount} pending</span>
      </div>

      {isGenerating ? (
        <p className="muted small">Wallet is generating keys. Approvals will unlock shortly.</p>
      ) : null}

      {approvals.length === 0 ? (
        <p className="muted">No pending approvals.</p>
      ) : (
        <div className="stack">
          {approvals.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} />
          ))}
        </div>
      )}
    </section>
  );
};
