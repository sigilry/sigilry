import type { FormEvent } from "react";
import { useId, useState } from "react";
import { useExerciseChoice } from "@sigilry/react";

import { InfoTooltip } from "../shared/InfoTooltip";
import { docsLinks } from "../../lib/docs";

interface AddTodoFormProps {
  partyId?: string | null;
  templateId: string;
  choice: string;
  todoListContractId: string | null;
  onPendingChange?: (pending: { description: string; submittedAt: number } | null) => void;
  onSubmitSuccess?: () => void;
}

export const AddTodoForm = ({
  partyId,
  templateId,
  choice,
  todoListContractId,
  onPendingChange,
  onSubmitSuccess,
}: AddTodoFormProps) => {
  const { exerciseAsync, isPending: isSubmitting, error: submitError } = useExerciseChoice();
  const [description, setDescription] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const isDisabled = isSubmitting || !partyId || !todoListContractId;
  const inputId = useId();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!partyId) {
      setLocalError("Connect a wallet before submitting commands.");
      return;
    }

    if (!description.trim()) {
      setLocalError("Enter a todo description.");
      return;
    }

    if (!todoListContractId) {
      setLocalError("Todo list contract not found.");
      return;
    }

    const trimmedDescription = description.trim();
    setLocalError(null);
    onPendingChange?.({ description: trimmedDescription, submittedAt: Date.now() });

    try {
      // useExerciseChoice sends a typed prepareExecuteAndWait call via the provider.
      // In this demo, the mock wallet will queue an approval before execution.
      await exerciseAsync({
        templateId,
        contractId: todoListContractId,
        choice,
        choiceArgument: {
          description: trimmedDescription,
        },
        actAs: [partyId],
      });
      setDescription("");
      onSubmitSuccess?.();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : String(err));
    } finally {
      onPendingChange?.(null);
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="form">
        <div className="field">
          <div className="title-row">
            <label htmlFor={inputId}>New todo</label>
            <InfoTooltip
              label="Submitting todos"
              description="Submitting a todo exercises TodoList.AddItem (factory) via useExerciseChoice."
              href={docsLinks.react}
            />
          </div>
          <input
            id={inputId}
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Write a new todo..."
            disabled={isDisabled}
          />
        </div>
        <button type="submit" disabled={isDisabled}>
          {isSubmitting ? "Submitting..." : "Create todo"}
        </button>
      </form>
      {localError ? <p className="error">{localError}</p> : null}
      {submitError ? <p className="error">{submitError.message}</p> : null}
    </>
  );
};
