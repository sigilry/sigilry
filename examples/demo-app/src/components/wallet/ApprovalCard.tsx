import { useWalletSimulator } from "../../hooks/useWalletSimulator";
import type { PendingApproval } from "../../lib/approval-queue";
import { shortenContractId, shortenPartyId } from "../../lib/format";
import { JsonViewer } from "../shared/JsonViewer";
import { StatusPill } from "../shared/StatusPill";
import { docsLinks } from "../../lib/docs";

interface ApprovalCardProps {
  approval: PendingApproval;
}

export const ApprovalCard = ({ approval }: ApprovalCardProps) => {
  const { approvalQueue, error, isGenerating } = useWalletSimulator();
  const isDisabled = approval.status !== "pending" || Boolean(error) || isGenerating;
  const timestampLabel = new Date(approval.timestamp).toLocaleString();
  const methodLabelMap: Record<string, string> = {
    prepareExecuteAndWait: "Submit command",
    prepareExecute: "Prepare command",
    signMessage: "Sign message",
  };

  const summarizeApproval = (params: unknown): string | null => {
    if (!params || typeof params !== "object") {
      return null;
    }

    const asRecord = (value: unknown): Record<string, unknown> | null => {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }
      return value as Record<string, unknown>;
    };

    const record = params as {
      commandId?: string;
      actAs?: string[];
      commands?: unknown[];
    };

    const summaryParts: string[] = [];
    const create = asRecord(
      record.commands
        ?.map((command) => asRecord(command))
        .find((command) => command?.CreateCommand !== undefined)?.CreateCommand,
    );
    const exercise = asRecord(
      record.commands
        ?.map((command) => asRecord(command))
        .find((command) => command?.ExerciseCommand !== undefined)?.ExerciseCommand,
    );

    if (exercise) {
      const choice = typeof exercise.choice === "string" ? exercise.choice : null;
      const contractId = typeof exercise.contractId === "string" ? exercise.contractId : null;
      const templateId = typeof exercise.templateId === "string" ? exercise.templateId : null;
      summaryParts.push(`Exercise ${choice ?? "choice"}`);
      if (templateId) {
        summaryParts.push(templateId.replace(/^#/, ""));
      }
      if (contractId) {
        summaryParts.push(`on ${shortenContractId(contractId)}`);
      }
    } else if (create) {
      const templateId = typeof create.templateId === "string" ? create.templateId : null;
      summaryParts.push("Create contract");
      if (templateId) {
        summaryParts.push(templateId.replace(/^#/, ""));
      }
    }

    if (record.actAs?.[0]) {
      summaryParts.push(`as ${shortenPartyId(record.actAs[0])}`);
    }

    if (record.commandId) {
      summaryParts.push(`cmd ${shortenContractId(record.commandId)}`);
    }

    return summaryParts.length > 0 ? summaryParts.join(" | ") : null;
  };

  const approvalDescriptionMap: Record<string, string> = {
    pending: "Waiting for your approval before submitting to the ledger.",
    approved: "Approved and submitted to the Canton ledger.",
    rejected: "Rejected by the wallet. The command was not submitted.",
  };
  const methodLabel = methodLabelMap[approval.method] ?? approval.method;
  const summary = summarizeApproval(approval.params);

  return (
    <section className="approval-card">
      <header className="approval-header">
        <div>
          <strong>{methodLabel}</strong>
          {summary ? <div className="approval-meta">{summary}</div> : null}
        </div>
        <div className="approval-meta">{timestampLabel}</div>
      </header>

      <div className="approval-status">
        <StatusPill
          status={approval.status}
          label={approval.status}
          description={approvalDescriptionMap[approval.status] ?? "Current approval state."}
          href={docsLinks.demoApp}
        />
      </div>

      <details className="details">
        <summary>View request payload</summary>
        <JsonViewer value={approval.params} maxLength={1600} />
      </details>

      {approval.error ? <p className="error">Reason: {approval.error}</p> : null}

      <div className="approval-actions">
        <button
          type="button"
          onClick={() => approvalQueue.approve(approval.id)}
          disabled={isDisabled}
        >
          Approve
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => approvalQueue.reject(approval.id)}
          disabled={isDisabled}
        >
          Reject
        </button>
      </div>
    </section>
  );
};
