import type { LedgerApiRequest, LedgerApiResponse } from "@sigilry/react";

const HOLDING_INTERFACE = "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding";

interface UsdcxInstrument {
  admin: string;
  id: string;
}

interface ExtractUsdcxHoldingsParams {
  senderPartyId: string;
  usdcx: UsdcxInstrument;
}

interface HoldingFilterBody {
  activeAtOffset: string;
  verbose: boolean;
  filter: {
    filtersByParty: Record<
      string,
      {
        cumulative: Array<{
          identifierFilter: {
            InterfaceFilter: {
              value: {
                interfaceId: string;
                includeInterfaceView: boolean;
                includeCreatedEventBlob: boolean;
              };
            };
          };
        }>;
      }
    >;
  };
}

export interface UsdcxHolding {
  contractId: string;
  owner: string;
  amount: string;
  instrumentAdmin: string;
  instrumentId: string;
  locked: boolean;
}

export interface LoadUsdcxHoldingsParams {
  senderPartyId: string;
  /** Bound `useLedgerApi().requestAsync` from the caller. */
  ledgerApiRequest: (params: LedgerApiRequest) => Promise<LedgerApiResponse<unknown>>;
  /** USDCx instrument config (admin party + id). */
  usdcx: UsdcxInstrument;
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const asString = (value: unknown): string | undefined => {
  return typeof value === "string" ? value : undefined;
};

const asFiniteNumericString = (value: unknown): string | undefined => {
  const unwrapped = scalar(value);
  if (typeof unwrapped !== "string" && typeof unwrapped !== "number") {
    return undefined;
  }

  return Number.isFinite(Number(unwrapped)) ? String(unwrapped) : undefined;
};

const parseAmount = (value: string): number => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const getField = (recordLike: unknown, label: string): unknown => {
  if (!recordLike) {
    return undefined;
  }

  if (isRecord(recordLike) && Array.isArray(recordLike.fields)) {
    const matchingField = recordLike.fields.find(
      (entry): entry is { label: string; value: unknown } =>
        isRecord(entry) && entry.label === label,
    );

    return matchingField?.value;
  }

  if (
    isRecord(recordLike) &&
    isRecord(recordLike.record) &&
    Array.isArray(recordLike.record.fields)
  ) {
    const matchingField = recordLike.record.fields.find(
      (entry): entry is { label: string; value: unknown } =>
        isRecord(entry) && entry.label === label,
    );
    return matchingField?.value;
  }

  if (isRecord(recordLike) && Object.prototype.hasOwnProperty.call(recordLike, label)) {
    return recordLike[label];
  }

  return undefined;
};

const requireField = (recordLike: unknown, label: string, contractId: string): unknown => {
  const value = getField(recordLike, label);
  if (value !== undefined) {
    return value;
  }

  // Reject malformed holding views early so the transfer picker cannot fabricate balances.
  throw new Error(`Holding ${contractId} view was missing required field "${label}".`);
};

const requireStringField = (recordLike: unknown, label: string, contractId: string): string => {
  const value = scalarString(requireField(recordLike, label, contractId));
  if (value !== undefined) {
    return value;
  }

  throw new Error(`Holding ${contractId} field "${label}" was not a string-like scalar.`);
};

const requireAmountField = (recordLike: unknown, contractId: string): string => {
  const value = asFiniteNumericString(requireField(recordLike, "amount", contractId));
  if (value !== undefined) {
    return value;
  }

  throw new Error(`Holding ${contractId} field "amount" was not a numeric scalar.`);
};

const requireLockState = (recordLike: unknown, contractId: string): boolean => {
  const value = requireField(recordLike, "lock", contractId);
  if (value === null) {
    return false;
  }

  if (isRecord(value)) {
    return true;
  }

  throw new Error(`Holding ${contractId} field "lock" had an invalid shape.`);
};

const parseHoldingView = (
  viewValue: unknown,
  contractId: string,
  params: ExtractUsdcxHoldingsParams,
): UsdcxHolding | null => {
  const owner = requireStringField(viewValue, "owner", contractId);
  const amount = requireAmountField(viewValue, contractId);
  const instrumentValue = requireField(viewValue, "instrumentId", contractId);
  const instrumentAdmin = requireStringField(instrumentValue, "admin", contractId);
  const instrumentId = requireStringField(instrumentValue, "id", contractId);
  const locked = requireLockState(viewValue, contractId);

  if (
    owner !== params.senderPartyId ||
    instrumentAdmin !== params.usdcx.admin ||
    instrumentId !== params.usdcx.id
  ) {
    return null;
  }

  return {
    contractId,
    owner,
    amount,
    instrumentAdmin,
    instrumentId,
    locked,
  };
};

const scalar = (value: unknown): string | number | boolean | null | undefined => {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of ["text", "party", "numeric", "contractId", "int64", "bool"] as const) {
    const inner = value[key];
    if (
      typeof inner === "string" ||
      typeof inner === "number" ||
      typeof inner === "boolean" ||
      inner === null
    ) {
      return inner;
    }
  }

  return undefined;
};

const scalarString = (value: unknown): string | undefined => {
  const unwrapped = scalar(value);
  if (unwrapped === null || unwrapped === undefined) {
    return undefined;
  }
  return String(unwrapped);
};

const findCreatedEvents = (node: unknown, out: Record<string, unknown>[]): void => {
  if (!node) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      findCreatedEvents(item, out);
    }
    return;
  }

  if (!isRecord(node)) {
    return;
  }

  if (isRecord(node.createdEvent)) {
    out.push(node.createdEvent);
  }

  for (const value of Object.values(node)) {
    findCreatedEvents(value, out);
  }
};

const buildHoldingsRequestBody = (
  senderPartyId: string,
  activeAtOffset: string,
): HoldingFilterBody => ({
  activeAtOffset,
  verbose: false,
  filter: {
    filtersByParty: {
      [senderPartyId]: {
        cumulative: [
          {
            identifierFilter: {
              InterfaceFilter: {
                value: {
                  interfaceId: HOLDING_INTERFACE,
                  includeInterfaceView: true,
                  includeCreatedEventBlob: false,
                },
              },
            },
          },
        ],
      },
    },
  },
});

const parseLedgerEndOffset = (payload: unknown): string => {
  if (!isRecord(payload)) {
    throw new Error("Ledger end response was not an object.");
  }

  const offset = payload.offset;
  if (typeof offset === "string" || typeof offset === "number") {
    return String(offset);
  }

  throw new Error("Ledger end response was missing an offset.");
};

export function extractUsdcxHoldingsFromPayload(
  payload: unknown,
  params: ExtractUsdcxHoldingsParams,
): UsdcxHolding[] {
  const createdEvents: Record<string, unknown>[] = [];
  findCreatedEvents(payload, createdEvents);

  const holdings: UsdcxHolding[] = [];

  for (const createdEvent of createdEvents) {
    const contractId = asString(createdEvent.contractId);
    const interfaceViews = Array.isArray(createdEvent.interfaceViews)
      ? createdEvent.interfaceViews
      : [];
    if (!contractId) {
      continue;
    }

    for (const view of interfaceViews) {
      const viewValue = isRecord(view) ? view.viewValue : undefined;
      if (!viewValue) {
        continue;
      }

      const holding = parseHoldingView(viewValue, contractId, params);
      if (holding) {
        holdings.push(holding);
        break;
      }
    }
  }

  return holdings;
}

export async function loadUsdcxHoldings(params: LoadUsdcxHoldingsParams): Promise<UsdcxHolding[]> {
  const ledgerEnd = await params.ledgerApiRequest({
    requestMethod: "get",
    resource: "/v2/state/ledger-end",
  });
  const activeAtOffset = parseLedgerEndOffset(ledgerEnd.data);

  const activeContracts = await params.ledgerApiRequest({
    requestMethod: "post",
    resource: "/v2/state/active-contracts",
    body: buildHoldingsRequestBody(params.senderPartyId, activeAtOffset),
  });

  return extractUsdcxHoldingsFromPayload(activeContracts.data, {
    senderPartyId: params.senderPartyId,
    usdcx: params.usdcx,
  });
}

/** Pick the minimum set of holdings that covers `amount`, preferring larger amounts first. */
export function selectHoldingsForAmount(
  holdings: UsdcxHolding[],
  amount: string,
): { selected: UsdcxHolding[]; total: number } {
  const target = parseAmount(amount);
  const selected: UsdcxHolding[] = [];
  const sorted = [...holdings].sort(
    (left, right) => parseAmount(right.amount) - parseAmount(left.amount),
  );

  let total = 0;
  for (const holding of sorted) {
    selected.push(holding);
    total += parseAmount(holding.amount);
    if (total >= target) {
      break;
    }
  }

  return { selected, total };
}
