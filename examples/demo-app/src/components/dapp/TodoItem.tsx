import { useState } from "react";
import { useExerciseChoice } from "@sigilry/react";

import { shortenContractId, shortenTemplateId } from "../../lib/format";
import { CopyableText } from "../shared/CopyableText";

interface TodoItemContract {
  contractId: string;
  templateId: string;
  createdAt?: string | null;
  payload: {
    description?: string | null;
    completed?: boolean | null;
  };
}

interface TodoItemProps {
  contract: TodoItemContract;
  partyId?: string | null;
  templateId: string;
}

export const TodoItem = ({ contract, partyId, templateId }: TodoItemProps) => {
  // The choice string must match the DAML choice names on TodoItem.
  // useExerciseChoice maps this call to a typed provider request.
  const { exerciseAsync, isPending, error } = useExerciseChoice();
  const [localError, setLocalError] = useState<string | null>(null);
  const isComplete = Boolean(contract.payload.completed);
  const isActionDisabled = isPending || !partyId;
  const titleClassName = `todo-title${isComplete ? " todo-title-complete" : ""}`;

  const handleExercise = async (choice: "Complete" | "Remove") => {
    if (!partyId) {
      setLocalError("Connect a wallet before submitting commands.");
      return;
    }

    setLocalError(null);

    try {
      await exerciseAsync({
        templateId,
        contractId: contract.contractId,
        choice,
        choiceArgument: {},
        actAs: [partyId],
      });
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <li>
      <div className="row">
        <span className={titleClassName}>{String(contract.payload.description ?? "Untitled")}</span>
        <div className="item-actions">
          {isComplete ? <span className="badge">Completed</span> : null}
          <button
            type="button"
            onClick={() => handleExercise("Complete")}
            disabled={isActionDisabled || isComplete}
          >
            Mark done
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => handleExercise("Remove")}
            disabled={isActionDisabled}
          >
            Remove
          </button>
        </div>
      </div>
      <div className="row small muted">
        <span title={contract.templateId}>{shortenTemplateId(contract.templateId)}</span>
        <span>{contract.createdAt ?? ""}</span>
        <CopyableText
          value={contract.contractId}
          displayValue={shortenContractId(contract.contractId)}
          label="contract id"
          textClassName="mono"
        />
      </div>
      {localError ? <p className="error">{localError}</p> : null}
      {error ? <p className="error">{error.message}</p> : null}
    </li>
  );
};
