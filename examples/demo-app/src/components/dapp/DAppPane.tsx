import { useCallback, useEffect, useMemo, useState } from "react";
import { useActiveAccount, useActiveContracts, useSubmitCommand } from "@sigilry/react";

import { demo_todo_package } from "../../generated/index";

import { AddTodoForm } from "./AddTodoForm";
import { ConnectionStatus } from "./ConnectionStatus";
import { RpcLog } from "./RpcLog";
import { TodoList } from "./TodoList";
import { InfoTooltip } from "../shared/InfoTooltip";
import { StatusPill } from "../shared/StatusPill";
import { docsLinks } from "../../lib/docs";
import { useLogOnChange } from "../../lib/logging";
import { shortenContractId, shortenPartyId } from "../../lib/format";

const toTemplateFilter = (templateId: string) => {
  const [packageName, moduleName, entityName] = templateId.replace(/^#/, "").split(":");
  if (!packageName || !moduleName || !entityName) {
    throw new Error(`Invalid templateId: ${templateId}`);
  }
  return { packageName, moduleName, entityName };
};

const TODO_ITEM_TEMPLATE_ID = demo_todo_package.TodoList.TodoItem.templateId;
const TODO_LIST_TEMPLATE_ID = demo_todo_package.TodoList.TodoList.templateId;
const TODO_ITEM_TEMPLATE = toTemplateFilter(TODO_ITEM_TEMPLATE_ID);
const TODO_LIST_TEMPLATE = toTemplateFilter(TODO_LIST_TEMPLATE_ID);

/* eslint-disable no-console */
export const DAppPane = () => {
  const { partyId } = useActiveAccount();
  const todoLists = useActiveContracts({
    templateFilter: TODO_LIST_TEMPLATE,
    refetchInterval: 2000,
  });

  useLogOnChange("[dapp] activeAccount changed", partyId ?? null);

  const todoListsLogState = useMemo(
    () => ({
      status: todoLists.isError ? "error" : todoLists.isLoading ? "loading" : "ready",
      count: todoLists.data.length,
      error: todoLists.error?.message ?? null,
    }),
    [todoLists.data.length, todoLists.error?.message, todoLists.isError, todoLists.isLoading],
  );
  useLogOnChange("[dapp] useActiveContracts changed", todoListsLogState);

  const [factoryError, setFactoryError] = useState<string | null>(null);
  const {
    submitAsync: submitCreateFactory,
    isPending: isCreatingFactory,
    error: createFactoryError,
  } = useSubmitCommand();

  const activeFactory = useMemo(() => {
    if (todoLists.data.length === 0) {
      return null;
    }

    const ownedFactories = partyId
      ? todoLists.data.filter(
          (contract) => (contract.payload as { owner?: string } | undefined)?.owner === partyId,
        )
      : [];

    const candidates = ownedFactories.length > 0 ? ownedFactories : todoLists.data;

    return [...candidates].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      return b.contractId.localeCompare(a.contractId);
    })[0];
  }, [partyId, todoLists.data]);

  const todoListContractId = activeFactory?.contractId ?? null;
  const factoryOwner = (activeFactory?.payload as { owner?: string } | undefined)?.owner ?? null;
  const activeFactoryOwner = factoryOwner ? shortenPartyId(factoryOwner) : null;

  const activeFactoryLogState = useMemo(() => {
    if (!activeFactory) {
      return {
        status: "missing",
        partyId: partyId ? shortenPartyId(partyId) : null,
      };
    }

    return {
      status: "selected",
      partyId: partyId ? shortenPartyId(partyId) : null,
      contractId: shortenContractId(activeFactory.contractId),
      templateId: activeFactory.templateId,
      owner: activeFactoryOwner,
      createdAt: activeFactory.createdAt ?? null,
    };
  }, [
    partyId,
    activeFactory?.contractId,
    activeFactory?.templateId,
    activeFactory?.createdAt,
    activeFactoryOwner,
  ]);
  useLogOnChange("[dapp] activeFactory changed", activeFactoryLogState);

  const [pendingTodo, setPendingTodo] = useState<{
    description: string;
    submittedAt: number;
  } | null>(null);
  const [lastSubmittedAt, setLastSubmittedAt] = useState<number | null>(null);

  const handleSubmitSuccess = useCallback(() => {
    setLastSubmittedAt(Date.now());
  }, []);

  useEffect(() => {
    if (!lastSubmittedAt) {
      return;
    }
    const timeout = window.setTimeout(() => setLastSubmittedAt(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [lastSubmittedAt]);

  const handleCreateFactory = useCallback(async () => {
    if (!partyId) {
      setFactoryError("Connect a wallet before creating the TodoList factory.");
      return;
    }

    setFactoryError(null);
    console.debug("[dapp] handleCreateFactory", {
      partyId,
      templateId: TODO_LIST_TEMPLATE_ID,
    });

    try {
      const result = await submitCreateFactory({
        commands: [
          {
            CreateCommand: {
              templateId: TODO_LIST_TEMPLATE_ID,
              createArguments: {
                owner: partyId,
              },
            },
          },
        ],
        actAs: [partyId],
      });
      console.debug("[dapp] createFactory result", result);
      todoLists.refetch();
    } catch (err) {
      setFactoryError(err instanceof Error ? err.message : String(err));
    }
  }, [partyId, submitCreateFactory, todoLists]);

  return (
    <div className="app">
      <ConnectionStatus />

      <section className="panel">
        <div className="panel-header">
          <div>
            <div className="title-row">
              <h2>Todo List</h2>
              <InfoTooltip
                label="Todo flow"
                description="Todos are created by exercising TodoList.AddItem (factory) and observed with useActiveContracts. The wallet will ask you to approve each todo."
                href={docsLinks.demoApp}
              />
            </div>
          </div>
        </div>
        <div className="factory-row">
          <div>
            <div className="row">
              <span className="title-row">
                <strong>TodoList Factory</strong>
                <InfoTooltip
                  label="Factory template"
                  description="TodoList.AddItem creates TodoItem contracts."
                  href={docsLinks.demoApp}
                />
              </span>
              {todoLists.isLoading ? (
                <StatusPill
                  status="connecting"
                  label="Loading"
                  description="Checking the ledger for an existing TodoList factory contract."
                  href={docsLinks.demoApp}
                />
              ) : todoListContractId ? (
                <StatusPill
                  status="approved"
                  label="Ready"
                  description="A TodoList factory contract is active on the ledger."
                  href={docsLinks.demoApp}
                />
              ) : (
                <StatusPill
                  status="pending"
                  label="Missing"
                  description="No factory contract found. Create one to start adding todos."
                  href={docsLinks.demoApp}
                />
              )}
            </div>
            {todoListContractId ? (
              <p className="muted small">
                Factory:{" "}
                <span className="mono" title={todoListContractId}>
                  {shortenContractId(todoListContractId)}
                </span>
              </p>
            ) : (
              <p className="muted small">Create a factory contract to start adding todos.</p>
            )}
            {todoListContractId ? (
              <p className="muted small">Create a new factory to switch the active list.</p>
            ) : null}
            {factoryOwner ? (
              <p className="muted small">
                Owner:{" "}
                <span className="mono" title={factoryOwner}>
                  {shortenPartyId(factoryOwner)}
                </span>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleCreateFactory}
            disabled={!partyId || isCreatingFactory}
          >
            {isCreatingFactory
              ? "Creating..."
              : todoListContractId
                ? "New TodoList"
                : "Create TodoList"}
          </button>
        </div>
        {factoryError ? <p className="error">{factoryError}</p> : null}
        {createFactoryError ? <p className="error">{createFactoryError.message}</p> : null}
        <AddTodoForm
          partyId={partyId}
          templateId={TODO_LIST_TEMPLATE_ID}
          choice={demo_todo_package.TodoList.TodoList.AddItem.choiceName}
          todoListContractId={todoListContractId}
          onPendingChange={setPendingTodo}
          onSubmitSuccess={handleSubmitSuccess}
        />
        <TodoList
          partyId={partyId}
          templateId={TODO_ITEM_TEMPLATE_ID}
          templateFilter={TODO_ITEM_TEMPLATE}
          pendingTodo={pendingTodo}
          lastSubmittedAt={lastSubmittedAt}
        />
      </section>

      <RpcLog />
    </div>
  );
};
