import { useMemo } from "react";
import { useActiveContracts } from "@sigilry/react";

import { TodoItem } from "./TodoItem";
import { StatusPill } from "../shared/StatusPill";
import { docsLinks } from "../../lib/docs";

interface TemplateFilter {
  packageName: string;
  moduleName: string;
  entityName: string;
}

interface TodoListProps {
  partyId?: string | null;
  templateId: string;
  templateFilter: TemplateFilter;
  pendingTodo?: { description: string; submittedAt: number } | null;
  lastSubmittedAt?: number | null;
}

export const TodoList = ({
  partyId,
  templateId,
  templateFilter,
  pendingTodo,
  lastSubmittedAt,
}: TodoListProps) => {
  // templateFilter maps directly to DAML identifiers:
  // packageName:moduleName:entityName -> contracts returned by ledgerApi active-contracts.
  const activeContracts = useActiveContracts({ templateFilter, refetchInterval: 2000 });
  const sortedContracts = useMemo(
    () => [...activeContracts.data].sort((a, b) => a.contractId.localeCompare(b.contractId)),
    [activeContracts.data],
  );

  if (activeContracts.isLoading) {
    return <p className="muted">Loading contracts...</p>;
  }

  if (!partyId) {
    return <p className="muted">Connect a wallet to view todo items.</p>;
  }

  if (sortedContracts.length === 0) {
    if (pendingTodo) {
      return (
        <div className="pending-row">
          <div>
            <strong>Pending approval</strong>
            <p className="muted small">{pendingTodo.description}</p>
          </div>
          <StatusPill
            status="pending"
            label="Awaiting"
            description="This todo is pending wallet approval before it appears on the ledger."
            href={docsLinks.demoApp}
          />
        </div>
      );
    }

    if (lastSubmittedAt) {
      return <p className="muted">Waiting for ledger update...</p>;
    }

    return <p className="muted">No todo items yet.</p>;
  }

  return (
    <>
      {pendingTodo ? (
        <div className="pending-row">
          <div>
            <strong>Pending approval</strong>
            <p className="muted small">{pendingTodo.description}</p>
          </div>
          <StatusPill
            status="pending"
            label="Awaiting"
            description="This todo is pending wallet approval before it appears on the ledger."
            href={docsLinks.demoApp}
          />
        </div>
      ) : null}
      <p className="muted small">{sortedContracts.length} items</p>
      <ul className="list">
        {sortedContracts.map((contract) => (
          <TodoItem
            key={contract.contractId}
            contract={contract}
            partyId={partyId}
            templateId={templateId}
          />
        ))}
      </ul>
    </>
  );
};
