import type { EventFormat, GetUpdatesRequest } from "@sigilry/canton-json-api";
import { zGetLedgerEndResponse } from "@sigilry/canton-json-api";

export type LedgerOffset = string & { readonly __ledgerOffsetBrand: unique symbol };
type LedgerOffsetInput = string | number | bigint;
type LedgerOffsetWire = string | number | bigint;
type UpdatesRequestLike = { beginExclusive?: LedgerOffsetInput };
type UpdatesRequestRecord = Record<string, unknown>;

const DEFAULT_RECENT_UPDATES_DEPTH = 100;
const MAX_LIST_ELEMENTS_CODE = "JSON_API_MAXIMUM_LIST_ELEMENTS_NUMBER_REACHED";
const MAX_LIST_ELEMENTS_REGEX = /number of matching elements|maximum-list-elements/i;

interface ParsedCreatedEvent {
  contractId: string;
  templateId: string;
  createArgument?: Record<string, unknown>;
  signatories?: string[];
  observers?: string[];
}

interface ParsedArchivedEvent {
  contractId: string;
  templateId: string;
}

export type ParsedUpdateEvent =
  | {
      kind: "created";
      created: ParsedCreatedEvent;
    }
  | {
      kind: "archived";
      archived: ParsedArchivedEvent;
    };

export interface ParsedTransaction {
  updateId: string;
  commandId?: string;
  offset: LedgerOffset;
  effectiveAt?: string;
  events: ParsedUpdateEvent[];
}

export interface ParsedUpdatesFlatsResponse {
  update: Array<{
    transaction?: ParsedTransaction;
  }>;
}

export interface ParsedActiveContractsCreatedEvent {
  contractId: string;
  templateId: string;
  createArgument?: Record<string, unknown>;
  signatories?: string[];
  observers?: string[];
  createdAt?: string;
}

export interface ParsedActiveContractsEntry {
  contractEntry?: {
    JsActiveContract?: {
      createdEvent?: ParsedActiveContractsCreatedEvent;
    };
  };
}

export interface ActiveContractsRequestBody {
  activeAtOffset: LedgerOffset;
  eventFormat: EventFormat;
}

export interface UpdatesFlatsRequestBody {
  beginExclusive: LedgerOffset;
  updateFormat: NonNullable<GetUpdatesRequest["updateFormat"]>;
}

export interface ParsedLatestPrunedOffsetResponse {
  participantPrunedUpToInclusive: LedgerOffset;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectStrings(value: unknown, out: string[], seen: Set<object>, depth = 0): void {
  if (depth > 4 || value === null || value === undefined) return;

  if (typeof value === "string") {
    out.push(value);
    return;
  }

  if (typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (value instanceof Error) {
    if (value.message) out.push(value.message);
    if (value.stack) out.push(value.stack);
  }

  for (const item of Object.values(value as Record<string, unknown>)) {
    collectStrings(item, out, seen, depth + 1);
  }

  try {
    out.push(JSON.stringify(value));
  } catch {
    // Some provider errors contain circular references; the already-collected fields are enough.
  }
}

function toStringArray(value: unknown, fieldName: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid ${fieldName} in ledger response`);
  }
  return value;
}

function parseWireNumberOffset(offset: number): LedgerOffset {
  if (!Number.isFinite(offset) || !Number.isInteger(offset) || offset < 0) {
    throw new Error(`Invalid ledger offset: ${offset}`);
  }

  // Keep wire parsing permissive for finite integers so polling doesn't stop on valid responses.
  return BigInt(offset).toString() as LedgerOffset;
}

function parseOptionalLedgerOffsetInput(offset: unknown): LedgerOffset | undefined {
  if (offset === undefined) {
    return undefined;
  }

  if (typeof offset === "string" || typeof offset === "number" || typeof offset === "bigint") {
    return parseLedgerOffsetInput(offset);
  }

  throw new Error(`Invalid ledger offset: ${String(offset)}`);
}

export function parseLedgerOffsetInput(offset: LedgerOffsetInput): LedgerOffset {
  if (typeof offset === "bigint") {
    if (offset < 0n) {
      throw new Error(`Invalid ledger offset: ${offset}`);
    }
    return offset.toString() as LedgerOffset;
  }

  if (typeof offset === "number") {
    if (!Number.isInteger(offset) || !Number.isSafeInteger(offset) || offset < 0) {
      throw new Error(`Invalid ledger offset: ${offset}`);
    }
    return BigInt(offset).toString() as LedgerOffset;
  }

  if (typeof offset === "string") {
    const trimmedOffset = offset.trim();
    if (!/^\d+$/.test(trimmedOffset)) {
      throw new Error(`Invalid ledger offset: ${offset}`);
    }
    return BigInt(trimmedOffset).toString() as LedgerOffset;
  }

  throw new Error(`Invalid ledger offset: ${String(offset)}`);
}

export function parseLedgerOffsetWire(offset: LedgerOffsetWire): LedgerOffset {
  if (typeof offset === "bigint") {
    if (offset < 0n) {
      throw new Error(`Invalid ledger offset: ${offset}`);
    }
    return offset.toString() as LedgerOffset;
  }

  if (typeof offset === "number") {
    return parseWireNumberOffset(offset);
  }

  if (typeof offset === "string") {
    const trimmedOffset = offset.trim();
    if (!/^\d+$/.test(trimmedOffset)) {
      throw new Error(`Invalid ledger offset: ${offset}`);
    }
    return BigInt(trimmedOffset).toString() as LedgerOffset;
  }

  throw new Error(`Invalid ledger offset: ${String(offset)}`);
}

export function parseLedgerEndResponse(payload: unknown): { offset: LedgerOffset } {
  const parsed = zGetLedgerEndResponse.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Invalid ledger end response");
  }

  try {
    return { offset: parseLedgerOffsetWire(parsed.data.offset) };
  } catch {
    throw new Error("Invalid ledger end response");
  }
}

export function parseLatestPrunedOffsetResponse(
  payload: unknown,
): ParsedLatestPrunedOffsetResponse {
  if (typeof payload === "string") {
    try {
      return parseLatestPrunedOffsetResponse(JSON.parse(payload));
    } catch {
      throw new Error("Invalid latest pruned offsets response");
    }
  }

  if (!isRecord(payload)) {
    throw new Error("Invalid latest pruned offsets response");
  }

  if (typeof payload.response === "string") {
    return parseLatestPrunedOffsetResponse(payload.response);
  }

  const offset = payload.participantPrunedUpToInclusive;
  if (typeof offset !== "string" && typeof offset !== "number" && typeof offset !== "bigint") {
    throw new Error("Invalid latest pruned offsets response");
  }

  try {
    return { participantPrunedUpToInclusive: parseLedgerOffsetWire(offset) };
  } catch {
    throw new Error("Invalid latest pruned offsets response");
  }
}

export function applyPrunedOffsetFloor(
  body: GetUpdatesRequest,
  prunedOffset: string,
): GetUpdatesRequest;
export function applyPrunedOffsetFloor<T extends UpdatesRequestLike>(
  body: T,
  prunedOffset: string,
): T;
export function applyPrunedOffsetFloor<T extends UpdatesRequestRecord>(
  body: T,
  prunedOffset: string,
): T & { beginExclusive: LedgerOffset };
export function applyPrunedOffsetFloor<T extends UpdatesRequestLike | UpdatesRequestRecord>(
  body: T,
  prunedOffset: string,
): T {
  const floor = parseLedgerOffsetInput(prunedOffset);
  const current = parseOptionalLedgerOffsetInput(body.beginExclusive);
  const next = current === undefined || BigInt(current) < BigInt(floor) ? floor : current;

  if (current !== undefined && next === current) {
    return body;
  }

  return {
    ...body,
    beginExclusive: next,
  };
}

export function deriveRecentBeginExclusive(
  body: GetUpdatesRequest,
  ledgerEndOffset: string,
  defaultDepth?: number,
): string;
export function deriveRecentBeginExclusive(
  body: UpdatesRequestLike,
  ledgerEndOffset: string,
  defaultDepth?: number,
): string;
export function deriveRecentBeginExclusive(
  body: UpdatesRequestRecord,
  ledgerEndOffset: string,
  defaultDepth?: number,
): string;
export function deriveRecentBeginExclusive(
  _body: UpdatesRequestLike | UpdatesRequestRecord,
  ledgerEndOffset: string,
  defaultDepth = DEFAULT_RECENT_UPDATES_DEPTH,
): string {
  if (!Number.isInteger(defaultDepth) || defaultDepth < 0) {
    throw new Error(`Invalid recent updates depth: ${defaultDepth}`);
  }

  const ledgerEnd = BigInt(parseLedgerOffsetInput(ledgerEndOffset));
  const depth = BigInt(defaultDepth);
  return ledgerEnd > depth ? (ledgerEnd - depth).toString() : "0";
}

export function isMaximumListElementsError(err: unknown): boolean {
  const candidates: string[] = [];
  collectStrings(err, candidates, new Set<object>());
  return candidates.some(
    (candidate) =>
      candidate.includes(MAX_LIST_ELEMENTS_CODE) || MAX_LIST_ELEMENTS_REGEX.test(candidate),
  );
}

export function buildActiveContractsRequestBody(
  activeAtOffset: LedgerOffsetInput,
  eventFormat: EventFormat,
): ActiveContractsRequestBody {
  const normalizedOffset = parseLedgerOffsetInput(activeAtOffset);
  // Keep offsets as normalized decimal strings so the body stays JSON-serializable without losing
  // ledger int64 precision when the extension proxies it onward.
  return {
    activeAtOffset: normalizedOffset,
    eventFormat,
  };
}

export function buildUpdatesFlatsRequestBody(
  beginExclusiveOffset: LedgerOffsetInput,
  updateFormat: NonNullable<GetUpdatesRequest["updateFormat"]>,
): UpdatesFlatsRequestBody {
  const normalizedOffset = parseLedgerOffsetInput(beginExclusiveOffset);
  // Keep offsets as normalized decimal strings so the body stays JSON-serializable without losing
  // ledger int64 precision when the extension proxies it onward.
  return {
    beginExclusive: normalizedOffset,
    updateFormat,
  };
}

interface ParsedCreatedEventBase {
  contractId: string;
  templateId: string;
  createArgument?: Record<string, unknown>;
  signatories?: string[];
  observers?: string[];
  createdAt?: string;
}

function parseCreatedEventBase(created: unknown, errorMessage: string): ParsedCreatedEventBase {
  if (!isRecord(created)) {
    throw new Error(errorMessage);
  }
  if (typeof created.contractId !== "string" || typeof created.templateId !== "string") {
    throw new Error(errorMessage);
  }

  let createArgument: Record<string, unknown> | undefined;
  if (created.createArgument !== undefined) {
    if (!isRecord(created.createArgument)) {
      throw new Error(errorMessage);
    }
    createArgument = created.createArgument;
  }

  let signatories: string[] | undefined;
  if (created.signatories !== undefined) {
    signatories = toStringArray(created.signatories, "signatories");
  }

  let observers: string[] | undefined;
  if (created.observers !== undefined) {
    observers = toStringArray(created.observers, "observers");
  }

  if (created.createdAt !== undefined && typeof created.createdAt !== "string") {
    throw new Error(errorMessage);
  }

  return {
    contractId: created.contractId,
    templateId: created.templateId,
    createArgument,
    signatories,
    observers,
    createdAt: created.createdAt,
  };
}

function parseCreatedEvent(created: unknown, errorMessage: string): ParsedCreatedEvent {
  const parsed = parseCreatedEventBase(created, errorMessage);
  return {
    contractId: parsed.contractId,
    templateId: parsed.templateId,
    createArgument: parsed.createArgument,
    signatories: parsed.signatories,
    observers: parsed.observers,
  };
}

function parseActiveContractsCreatedEvent(
  created: unknown,
  errorMessage: string,
): ParsedActiveContractsCreatedEvent {
  return parseCreatedEventBase(created, errorMessage);
}

function parseArchivedEvent(archived: unknown, errorMessage: string): ParsedArchivedEvent {
  if (!isRecord(archived)) {
    throw new Error(errorMessage);
  }
  if (typeof archived.contractId !== "string" || typeof archived.templateId !== "string") {
    throw new Error(errorMessage);
  }

  return {
    contractId: archived.contractId,
    templateId: archived.templateId,
  };
}

function parseUpdateEvent(event: unknown, errorMessage: string): ParsedUpdateEvent | null {
  if (!isRecord(event)) {
    throw new Error(errorMessage);
  }

  // Canton's JSON API emits events in two shapes:
  //   - Legacy / spec-incomplete: { created: {...} } / { archived: {...} }
  //   - CIP-0103 PascalCase: { CreatedEvent: { value: {...} } } /
  //     { ArchivedEvent: { value: {...} } } / { ExercisedEvent: { value: {...} } }
  // Accept both for the kinds this hook surfaces (created/archived). For any
  // other discriminator (ExercisedEvent, etc.) return null so the caller can
  // skip the entry instead of erroring the whole poll.
  if (event.created !== undefined) {
    return { kind: "created", created: parseCreatedEvent(event.created, errorMessage) };
  }
  if (event.archived !== undefined) {
    return { kind: "archived", archived: parseArchivedEvent(event.archived, errorMessage) };
  }
  if (isRecord(event.CreatedEvent) && isRecord(event.CreatedEvent.value)) {
    return {
      kind: "created",
      created: parseCreatedEvent(event.CreatedEvent.value, errorMessage),
    };
  }
  if (isRecord(event.ArchivedEvent) && isRecord(event.ArchivedEvent.value)) {
    return {
      kind: "archived",
      archived: parseArchivedEvent(event.ArchivedEvent.value, errorMessage),
    };
  }

  return null;
}

export function parseUpdatesFlatsResponse(payload: unknown): ParsedUpdatesFlatsResponse {
  // Canton's JSON API for /v2/updates/flats returns an *array* of streaming
  // chunks. Each chunk matches the codegen `JsGetUpdatesResponse` (in
  // @sigilry/canton-json-api/types.gen.ts) and has the shape:
  //   { update: { <Discriminator>: { value: {...} } } }
  // where <Discriminator> is the CIP-0103 PascalCase key on the `Update`
  // discriminated union: Transaction | OffsetCheckpoint | Reassignment |
  // TopologyTransaction. Only Transaction is meaningful for this hook; the
  // rest are returned as empty entries so the caller can advance offset
  // without surfacing them as ledger updates.
  //
  // The codegen exposes `JsGetUpdatesResponse` as the per-item type but loses
  // the array-level wrapping at the response-schema layer (canton's openapi
  // spec defines the response as `array<JsGetUpdatesResponse>`). When that
  // gap is fixed upstream, this parser can be replaced with type narrowing
  // against the generated types directly. Tracked as follow-up.
  if (!Array.isArray(payload)) {
    throw new Error("Invalid /v2/updates/flats response");
  }

  const update = payload.map((entry): { transaction?: ParsedTransaction } => {
    if (!isRecord(entry)) {
      throw new Error("Invalid /v2/updates/flats response");
    }

    const updateField = entry.update;
    if (!isRecord(updateField)) {
      throw new Error("Invalid /v2/updates/flats response");
    }

    const txWrapper = updateField.Transaction;
    if (!isRecord(txWrapper)) {
      // Non-Transaction discriminator (OffsetCheckpoint, Reassignment,
      // TopologyTransaction). Nothing to surface; advance silently.
      return {};
    }

    const transactionPayload = txWrapper.value;
    if (!isRecord(transactionPayload)) {
      throw new Error("Invalid /v2/updates/flats response");
    }

    const transaction = transactionPayload;
    if (typeof transaction.updateId !== "string") {
      throw new Error("Invalid /v2/updates/flats response");
    }
    if (transaction.commandId !== undefined && typeof transaction.commandId !== "string") {
      throw new Error("Invalid /v2/updates/flats response");
    }
    if (transaction.effectiveAt !== undefined && typeof transaction.effectiveAt !== "string") {
      throw new Error("Invalid /v2/updates/flats response");
    }
    if (
      transaction.offset === undefined ||
      (typeof transaction.offset !== "string" &&
        typeof transaction.offset !== "number" &&
        typeof transaction.offset !== "bigint")
    ) {
      throw new Error("Invalid /v2/updates/flats response");
    }

    const eventsRaw = transaction.events ?? [];
    if (!Array.isArray(eventsRaw)) {
      throw new Error("Invalid /v2/updates/flats response");
    }

    const events = eventsRaw
      .map((event) => parseUpdateEvent(event, "Invalid /v2/updates/flats response"))
      .filter((event): event is ParsedUpdateEvent => event !== null);

    const normalizedOffset =
      typeof transaction.offset === "number"
        ? parseWireNumberOffset(transaction.offset)
        : parseLedgerOffsetWire(transaction.offset);

    return {
      transaction: {
        updateId: transaction.updateId,
        commandId: transaction.commandId,
        offset: normalizedOffset,
        effectiveAt: transaction.effectiveAt,
        events,
      },
    };
  });

  return { update };
}

export function parseActiveContractsResponse(payload: unknown): ParsedActiveContractsEntry[] {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid active contracts response");
  }

  return payload.map((entry): ParsedActiveContractsEntry => {
    if (!isRecord(entry)) {
      throw new Error("Invalid active contracts response");
    }

    if (entry.contractEntry === undefined) {
      return {};
    }
    if (!isRecord(entry.contractEntry)) {
      throw new Error("Invalid active contracts response");
    }

    const jsActiveContract = entry.contractEntry.JsActiveContract;
    if (jsActiveContract === undefined) {
      return { contractEntry: {} };
    }
    if (!isRecord(jsActiveContract)) {
      throw new Error("Invalid active contracts response");
    }

    const createdEvent = jsActiveContract.createdEvent;
    if (createdEvent === undefined) {
      return { contractEntry: { JsActiveContract: {} } };
    }

    return {
      contractEntry: {
        JsActiveContract: {
          createdEvent: parseActiveContractsCreatedEvent(
            createdEvent,
            "Invalid active contracts response",
          ),
        },
      },
    };
  });
}
