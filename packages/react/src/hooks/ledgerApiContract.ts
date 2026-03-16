import type { EventFormat, GetUpdatesRequest } from "@sigilry/canton-json-api";
import { zGetLedgerEndResponse } from "@sigilry/canton-json-api";
import JSONbig from "json-bigint";

export type LedgerOffset = string & { readonly __ledgerOffsetBrand: unique symbol };
type LedgerOffsetInput = string | number | bigint;
type LedgerOffsetWire = string | number | bigint;

const wireJson = JSONbig({
  strict: true,
  useNativeBigInt: true,
});

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseWireJson(response: string, errorMessage: string): unknown {
  try {
    return wireJson.parse(response) as unknown;
  } catch {
    throw new Error(errorMessage);
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

export function parseLedgerEndResponse(response: string): { offset: LedgerOffset } {
  const payload = parseWireJson(response, "Invalid ledger end response");
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

export function buildActiveContractsRequestBody(
  activeAtOffset: LedgerOffsetInput,
  eventFormat: EventFormat,
): string {
  const normalizedOffset = parseLedgerOffsetInput(activeAtOffset);
  return `{"activeAtOffset":${normalizedOffset},"eventFormat":${JSON.stringify(eventFormat)}}`;
}

export function buildUpdatesFlatsRequestBody(
  beginExclusiveOffset: LedgerOffsetInput,
  updateFormat: NonNullable<GetUpdatesRequest["updateFormat"]>,
): string {
  const normalizedOffset = parseLedgerOffsetInput(beginExclusiveOffset);
  return `{"beginExclusive":${normalizedOffset},"updateFormat":${JSON.stringify(updateFormat)}}`;
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

function parseUpdateEvent(event: unknown, errorMessage: string): ParsedUpdateEvent {
  if (!isRecord(event)) {
    throw new Error(errorMessage);
  }

  if (event.created !== undefined) {
    return { kind: "created", created: parseCreatedEvent(event.created, errorMessage) };
  }
  if (event.archived !== undefined) {
    return { kind: "archived", archived: parseArchivedEvent(event.archived, errorMessage) };
  }

  throw new Error(errorMessage);
}

export function parseUpdatesFlatsResponse(response: string): ParsedUpdatesFlatsResponse {
  const payload = parseWireJson(response, "Invalid /v2/updates/flats response");
  if (!isRecord(payload)) {
    throw new Error("Invalid /v2/updates/flats response");
  }

  if (payload.update === undefined) {
    return { update: [] };
  }
  if (!Array.isArray(payload.update)) {
    throw new Error("Invalid /v2/updates/flats response");
  }

  const update = payload.update.map((entry): { transaction?: ParsedTransaction } => {
    if (!isRecord(entry)) {
      throw new Error("Invalid /v2/updates/flats response");
    }
    if (entry.transaction === undefined) {
      return {};
    }
    if (!isRecord(entry.transaction)) {
      throw new Error("Invalid /v2/updates/flats response");
    }

    const transaction = entry.transaction;
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

    const events = eventsRaw.map((event) =>
      parseUpdateEvent(event, "Invalid /v2/updates/flats response"),
    );

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

export function parseActiveContractsResponse(response: string): ParsedActiveContractsEntry[] {
  const payload = parseWireJson(response, "Invalid active contracts response");
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
