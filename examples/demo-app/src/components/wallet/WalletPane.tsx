import React from "react";

import { ApprovalQueue } from "./ApprovalQueue";
import { AccountInfo } from "./AccountInfo";
import { KeypairDisplay } from "./KeypairDisplay";

export const WalletPane = () => (
  <div className="app">
    <header className="pane-header">
      <p className="eyebrow">Wallet Simulator</p>
      <h2>Review & Approve</h2>
      <p className="subtitle">
        This pane represents a Canton wallet. Approve requests to submit them to the ledger.
      </p>
    </header>
    <KeypairDisplay />
    <ApprovalQueue />
    <AccountInfo />
  </div>
);
