import { useEffect, useState } from "react";
import { type JsPrepareSubmissionRequest } from "@sigilry/dapp/schemas";
import {
  parseError,
  useActiveAccount,
  useCanton,
  useLedgerApi,
  useSubmitCommand,
} from "@sigilry/react";

import { JsonViewer } from "../../components/shared/JsonViewer";
import { StatusPill } from "../../components/shared/StatusPill";
import { shortenContractId, shortenPartyId } from "../../lib/format";
import {
  type ProtobufValue,
  type ScanAnyValue,
  scanValueToAnyValue,
  vContractId,
  vList,
  vNumeric,
  vParty,
  vRecord,
  vText,
  vTextMap,
  vTimestamp,
} from "../../lib/protobuf-value";
import {
  loadUsdcxHoldings,
  selectHoldingsForAmount,
  type UsdcxHolding,
} from "../../lib/usdcx-holdings";

/**
 * Hooks used here:
 * - `useActiveAccount` for sender party and connection state.
 * - `useLedgerApi({ parse: (raw) => raw })` as the current escape hatch for the
 *   Holding interface-filter query.
 * - `useSubmitCommand` for the full `prepareExecuteAndWait` payload, including
 *   disclosed contracts.
 * - `useCanton().onTxChanged(handler)` for transaction visibility while the
 *   wallet approval flow is in flight.
 *
 * `.rl/audit/GIST-MAPPING.md` documents why the holdings query cannot use
 * `useActiveContracts` yet: the current hook surface does not expose interface
 * filters. Once `useActiveContracts({ interfaceFilters: [...] })` exists, it
 * should replace the imperative `useLedgerApi` call in this example.
 */

const DEFAULT_RECEIVER =
  "cantonwallet-allen-treasure-vault::12204290436defd80f672814046e8770d6583847f6cc608b772bd760c2f6892fa2f7";

const USDCX = {
  admin:
    "decentralized-usdc-interchain-rep::122049e2af8a725bd19759320fc83c638e7718973eac189d8f201309c512d1ffec61",
  id: "USDCx",
} as const;

const TRANSFER_FACTORY_URL = `https://api.utilities.digitalasset-staging.com/api/token-standard/v0/registrars/${encodeURIComponent(
  USDCX.admin,
)}/registry/transfer-instruction/v1/transfer-factory`;

const TRANSFER_FACTORY_TEMPLATE_ID =
  "#splice-api-token-transfer-instruction-v1:Splice.Api.Token.TransferInstructionV1:TransferFactory";

interface SelectionSummary {
  all: UsdcxHolding[];
  unlocked: UsdcxHolding[];
  selected: UsdcxHolding[];
  total: number;
}

interface TransferFactorySnapshot {
  raw: unknown;
  transferKind: string;
  factoryId: string;
  choiceContextValues: Record<string, ScanAnyValue>;
  disclosedContracts: NonNullable<JsPrepareSubmissionRequest["disclosedContracts"]>;
}

type WorkflowState =
  | { kind: "idle" }
  | { kind: "loading-holdings" }
  | { kind: "loading-factory"; selection: SelectionSummary }
  | { kind: "submitting"; selection: SelectionSummary; factory: TransferFactorySnapshot }
  | { kind: "done"; selection: SelectionSummary; factory: TransferFactorySnapshot }
  | {
      kind: "error";
      message: string;
      selection?: SelectionSummary;
      factory?: TransferFactorySnapshot;
    };

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const formatAmount = (value: number): string => value.toFixed(2);

const parseAmount = (value: string): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
};

const getErrorMessage = (error: unknown): string => parseError(error).message;

const normalizeChoiceContextValue = (value: unknown): ScanAnyValue | null => {
  if (typeof value === "string") {
    return value;
  }

  if (!isRecord(value) || typeof value.tag !== "string") {
    return null;
  }

  switch (value.tag) {
    case "AV_Text":
      return typeof value.value === "string" ? { tag: value.tag, value: value.value } : null;
    case "AV_ContractId":
      return typeof value.value === "string" ? { tag: value.tag, value: value.value } : null;
    case "AV_Bool":
      return typeof value.value === "boolean" ? { tag: value.tag, value: value.value } : null;
    case "AV_List":
      if (!Array.isArray(value.value)) {
        return null;
      }

      return {
        tag: value.tag,
        value: value.value.flatMap((entry) => {
          const normalized = normalizeChoiceContextValue(entry);
          return normalized ? [normalized] : [];
        }),
      };
    default: {
      const inner = value.value;
      if (
        typeof inner === "string" ||
        typeof inner === "number" ||
        typeof inner === "boolean" ||
        inner === null
      ) {
        return {
          tag: value.tag,
          value: inner,
        };
      }

      if (Array.isArray(inner)) {
        const normalizedList = inner.flatMap((entry) => {
          const normalized = normalizeChoiceContextValue(entry);
          return normalized ? [normalized] : [];
        });
        return {
          tag: value.tag,
          value: normalizedList,
        };
      }

      if (!isRecord(inner)) {
        return null;
      }

      const normalizedObject: Record<string, string | number | boolean | null> = {};
      for (const [key, entry] of Object.entries(inner)) {
        if (
          typeof entry !== "string" &&
          typeof entry !== "number" &&
          typeof entry !== "boolean" &&
          entry !== null
        ) {
          return null;
        }
        normalizedObject[key] = entry;
      }

      return {
        tag: value.tag,
        value: normalizedObject,
      };
    }
  }
};

const parseChoiceContextValues = (value: unknown): Record<string, ScanAnyValue> => {
  if (!isRecord(value)) {
    return {};
  }

  const out: Record<string, ScanAnyValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const normalized = normalizeChoiceContextValue(entry);
    if (normalized) {
      out[key] = normalized;
    }
  }

  return out;
};

const parseDisclosedContracts = (
  value: unknown,
): NonNullable<JsPrepareSubmissionRequest["disclosedContracts"]> => {
  if (!Array.isArray(value)) {
    return [];
  }

  const out: NonNullable<JsPrepareSubmissionRequest["disclosedContracts"]> = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.createdEventBlob !== "string") {
      continue;
    }

    out.push({
      createdEventBlob: entry.createdEventBlob,
      contractId: typeof entry.contractId === "string" ? entry.contractId : undefined,
      synchronizerId: typeof entry.synchronizerId === "string" ? entry.synchronizerId : undefined,
    });
  }

  return out;
};

const parseTransferFactoryResponse = (payload: unknown): TransferFactorySnapshot => {
  if (!isRecord(payload)) {
    throw new Error("transfer-factory returned a non-object payload.");
  }

  if (typeof payload.factoryId !== "string" || payload.factoryId.length === 0) {
    throw new Error(`transfer-factory response missing factoryId: ${JSON.stringify(payload)}`);
  }

  if (typeof payload.transferKind !== "string" || payload.transferKind.length === 0) {
    throw new Error(`transfer-factory response missing transferKind: ${JSON.stringify(payload)}`);
  }

  const choiceContext = isRecord(payload.choiceContext) ? payload.choiceContext : {};
  const choiceContextData = isRecord(choiceContext.choiceContextData)
    ? choiceContext.choiceContextData
    : {};

  return {
    raw: payload,
    transferKind: payload.transferKind,
    factoryId: payload.factoryId,
    choiceContextValues: parseChoiceContextValues(choiceContextData.values),
    disclosedContracts: parseDisclosedContracts(choiceContext.disclosedContracts),
  };
};

const readJsonResponse = async (response: Response): Promise<unknown> => {
  const text = await response.text();
  if (text.trim().length === 0) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const buildChoiceArgument = (
  senderPartyId: string,
  receiverPartyId: string,
  amount: string,
  inputHoldingCids: string[],
  factory: TransferFactorySnapshot,
): ProtobufValue => {
  const instrumentIdValue = vRecord([
    ["admin", vParty(USDCX.admin)],
    ["id", vText(USDCX.id)],
  ]);

  const requestedAt = new Date(Date.now() - 1000).toISOString();
  const executeBefore = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const transferValue = vRecord([
    ["sender", vParty(senderPartyId)],
    ["receiver", vParty(receiverPartyId)],
    ["amount", vNumeric(amount)],
    ["instrumentId", instrumentIdValue],
    ["requestedAt", vTimestamp(requestedAt)],
    ["executeBefore", vTimestamp(executeBefore)],
    ["inputHoldingCids", vList(inputHoldingCids.map(vContractId))],
    ["meta", vRecord([["values", vTextMap([])]])],
  ]);

  const contextEntries = Object.entries(factory.choiceContextValues).map(([key, value]) => ({
    key,
    value: scanValueToAnyValue(value),
  }));

  const choiceContextValue = vRecord([["values", vTextMap(contextEntries)]]);
  const emptyChoiceContext = vRecord([["values", vTextMap([])]]);
  const extraArgsValue = vRecord([
    ["context", choiceContextValue],
    ["meta", emptyChoiceContext],
  ]);

  return vRecord([
    ["expectedAdmin", vParty(USDCX.admin)],
    ["transfer", transferValue],
    ["extraArgs", extraArgsValue],
  ]);
};

const getWorkflowStatus = (
  state: WorkflowState,
  isConnected: boolean,
): {
  status: "connected" | "disconnected" | "pending" | "error" | "approved";
  label: string;
  description: string;
} => {
  if (!isConnected) {
    return {
      status: "disconnected",
      label: "Connect required",
      description: "Use the Active Contracts example to connect a wallet, then return here.",
    };
  }

  switch (state.kind) {
    case "idle":
      return {
        status: "connected",
        label: "Ready",
        description: "The sender account is connected and the transfer form is ready.",
      };
    case "loading-holdings":
      return {
        status: "pending",
        label: "Loading holdings",
        description: "Querying the Holding interface via the ledgerApi escape hatch.",
      };
    case "loading-factory":
      return {
        status: "pending",
        label: "Resolving factory",
        description: "Fetching the public Token Standard transfer-factory response.",
      };
    case "submitting":
      return {
        status: "pending",
        label: "Submitting",
        description: "Submitting prepareExecuteAndWait through useSubmitCommand.",
      };
    case "done":
      return {
        status: "approved",
        label: "Submitted",
        description: "The wallet approved the transfer and the transaction executed.",
      };
    case "error":
      return {
        status: "error",
        label: "Error",
        description: state.message,
      };
    default: {
      const exhaustive: never = state;
      return exhaustive;
    }
  }
};

export const UsdcxTransferExample = () => {
  const activeAccount = useActiveAccount();
  const { requestAsync: ledgerApiRequestAsync } = useLedgerApi<unknown>({ parse: (raw) => raw });
  const { submitAsync, isPending, data, error, reset } = useSubmitCommand();
  const { onTxChanged } = useCanton();

  const [receiver, setReceiver] = useState(DEFAULT_RECEIVER);
  const [amount, setAmount] = useState("1.00");
  const [state, setState] = useState<WorkflowState>({ kind: "idle" });
  const [latestTxEvent, setLatestTxEvent] = useState<unknown>(null);

  useEffect(() => {
    const unsubscribe = onTxChanged((event) => {
      setLatestTxEvent(event);
    });

    return unsubscribe;
  }, [onTxChanged]);

  const receiverError =
    receiver.trim().length === 0
      ? "Receiver party ID is required."
      : receiver.includes("::")
        ? null
        : 'Receiver must be a full Canton party ID containing "::".';
  const numericAmount = parseAmount(amount);
  const amountError =
    amount.trim().length === 0
      ? "Amount is required."
      : Number.isFinite(numericAmount) && numericAmount > 0
        ? null
        : "Amount must be a positive number.";
  const isBusy =
    isPending ||
    state.kind === "loading-holdings" ||
    state.kind === "loading-factory" ||
    state.kind === "submitting";
  const isDisabled =
    isBusy || !activeAccount.data || receiverError !== null || amountError !== null;

  const selection =
    state.kind === "loading-factory" ||
    state.kind === "submitting" ||
    state.kind === "done" ||
    state.kind === "error"
      ? state.selection
      : undefined;
  const factory =
    state.kind === "submitting" || state.kind === "done" || state.kind === "error"
      ? state.factory
      : undefined;
  const workflowStatus = getWorkflowStatus(state, activeAccount.isConnected);
  const errorMessage = state.kind === "error" ? state.message : error?.message;

  const onTransfer = async () => {
    const senderPartyId = activeAccount.partyId;
    if (!senderPartyId) {
      return;
    }

    reset();
    setState({ kind: "loading-holdings" });

    let currentSelection: SelectionSummary | undefined;
    let currentFactory: TransferFactorySnapshot | undefined;

    try {
      const allHoldings = await loadUsdcxHoldings({
        senderPartyId,
        ledgerApiRequest: ledgerApiRequestAsync,
        usdcx: USDCX,
      });
      const unlocked = allHoldings.filter((holding) => !holding.locked);

      if (unlocked.length === 0) {
        throw new Error(
          allHoldings.length > 0
            ? `All ${allHoldings.length} USDCx holding(s) are locked. Wait for in-flight transfers to settle.`
            : "No USDCx holdings found for the connected account.",
        );
      }

      const selectedSummary = selectHoldingsForAmount(unlocked, amount);
      if (selectedSummary.total < numericAmount) {
        throw new Error(
          `Insufficient USDCx balance. Need ${amount}, found ${formatAmount(selectedSummary.total)}.`,
        );
      }

      const selectionSummary: SelectionSummary = {
        all: allHoldings,
        unlocked,
        selected: selectedSummary.selected,
        total: selectedSummary.total,
      };
      currentSelection = selectionSummary;

      setState({ kind: "loading-factory", selection: selectionSummary });

      const transferFactoryBody = {
        choiceArguments: {
          expectedAdmin: USDCX.admin,
          transfer: {
            sender: senderPartyId,
            receiver,
            amount,
            instrumentId: {
              admin: USDCX.admin,
              id: USDCX.id,
            },
            requestedAt: new Date(Date.now() - 1000).toISOString(),
            executeBefore: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
            inputHoldingCids: selectionSummary.selected.map((holding) => holding.contractId),
            meta: { values: {} },
          },
          extraArgs: {
            context: { values: {} },
            meta: { values: {} },
          },
        },
        excludeDebugFields: true,
      };

      const response = await fetch(TRANSFER_FACTORY_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(transferFactoryBody),
      });
      const responsePayload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(
          `transfer-factory failed: ${response.status} ${typeof responsePayload === "string" ? responsePayload : JSON.stringify(responsePayload)}`,
        );
      }

      const transferFactory = parseTransferFactoryResponse(responsePayload);
      currentFactory = transferFactory;
      setState({
        kind: "submitting",
        selection: selectionSummary,
        factory: transferFactory,
      });

      const choiceArgument = buildChoiceArgument(
        senderPartyId,
        receiver,
        amount,
        selectionSummary.selected.map((holding) => holding.contractId),
        transferFactory,
      );

      const request: JsPrepareSubmissionRequest = {
        commandId: crypto.randomUUID(),
        commands: [
          {
            ExerciseCommand: {
              templateId: TRANSFER_FACTORY_TEMPLATE_ID,
              contractId: transferFactory.factoryId,
              choice: "TransferFactory_Transfer",
              choiceArgument,
            },
          },
        ],
        disclosedContracts: transferFactory.disclosedContracts,
      };

      await submitAsync(request);
      setState({
        kind: "done",
        selection: selectionSummary,
        factory: transferFactory,
      });
    } catch (submitError) {
      setState({
        kind: "error",
        message: getErrorMessage(submitError),
        selection: currentSelection,
        factory: currentFactory,
      });
    }
  };

  return (
    <div className="stack">
      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Connect State</h3>
            <p className="muted">
              The sender comes from `useActiveAccount`. If the wallet is not connected yet, switch
              to the Active Contracts example to connect and then return here.
            </p>
          </div>
          <StatusPill
            status={workflowStatus.status}
            label={workflowStatus.label}
            description={workflowStatus.description}
          />
        </div>
        <div className="stat">
          <span className="label">Sender</span>
          <span className="value mono" title={activeAccount.partyId ?? undefined}>
            {activeAccount.partyId ? shortenPartyId(activeAccount.partyId) : "Not connected"}
          </span>
        </div>
        <div className="stat">
          <span className="label">Instrument</span>
          <span className="value mono">{USDCX.id}</span>
        </div>
        {activeAccount.error ? <p className="error">{activeAccount.error.message}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Transfer Input</h3>
            <p className="muted">
              This matches the browser-console gist, but submits through React hooks instead of
              direct provider RPC calls.
            </p>
          </div>
        </div>
        <div className="form">
          <label className="field">
            <span>Receiver party ID</span>
            <input
              type="text"
              value={receiver}
              onChange={(event) => {
                setReceiver(event.target.value);
              }}
              placeholder={DEFAULT_RECEIVER}
            />
          </label>
          <label className="field">
            <span>Amount</span>
            <input
              type="text"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
              }}
              placeholder="1.00"
            />
          </label>
          <button type="button" onClick={onTransfer} disabled={isDisabled}>
            {state.kind === "loading-holdings"
              ? "Loading holdings..."
              : state.kind === "loading-factory"
                ? "Resolving factory..."
                : state.kind === "submitting" || isPending
                  ? "Submitting..."
                  : "Prepare & Transfer"}
          </button>
        </div>
        {receiverError ? <p className="error">{receiverError}</p> : null}
        {amountError ? <p className="error">{amountError}</p> : null}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3>Status</h3>
            <p className="muted">
              Holdings come from an interface-filter ledger query, the transfer-factory stays a
              plain REST fetch, and submission goes through `useSubmitCommand`.
            </p>
          </div>
          <span className="count-pill">{selection?.selected.length ?? 0} selected</span>
        </div>

        <div className="stat">
          <span className="label">Selected holdings total</span>
          <span className="value">{selection ? formatAmount(selection.total) : "—"}</span>
        </div>
        <div className="stat">
          <span className="label">Unlocked holdings</span>
          <span className="value">
            {selection ? `${selection.unlocked.length} of ${selection.all.length}` : "—"}
          </span>
        </div>
        {selection ? (
          <ul className="list">
            {selection.selected.map((holding) => (
              <li key={holding.contractId}>
                <div className="row">
                  <span className="mono" title={holding.contractId}>
                    {shortenContractId(holding.contractId)}
                  </span>
                  <span>{holding.amount}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No holdings selected yet.</p>
        )}

        <div className="stat" style={{ marginTop: "1rem" }}>
          <span className="label">transferKind</span>
          <span className="value">{factory?.transferKind ?? "—"}</span>
        </div>
        <div className="stat">
          <span className="label">factoryId</span>
          <span className="value mono" title={factory?.factoryId}>
            {factory?.factoryId ? shortenContractId(factory.factoryId) : "—"}
          </span>
        </div>
        {factory ? <JsonViewer value={factory.raw} maxLength={1800} /> : null}

        <div className="stat" style={{ marginTop: "1rem" }}>
          <span className="label">prepareExecuteAndWait</span>
          <span className="value">
            {data ? `${data.tx.commandId} @ ${data.tx.payload.updateId}` : "—"}
          </span>
        </div>
        {data ? <JsonViewer value={data} maxLength={1800} /> : null}

        <div className="stat" style={{ marginTop: "1rem" }}>
          <span className="label">Latest txChanged</span>
          <span className="value">{latestTxEvent ? "received" : "waiting"}</span>
        </div>
        {latestTxEvent ? <JsonViewer value={latestTxEvent} maxLength={1200} /> : null}

        {errorMessage ? <p className="error">{errorMessage}</p> : null}
      </section>
    </div>
  );
};
