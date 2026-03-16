import type {
  JsPrepareSubmissionRequest,
  LedgerApiRequest,
  PrepareExecuteAndWaitResult,
} from "@sigilry/dapp/schemas";

import { shortenContractId } from "./format";
import { createChangeGate } from "./logging";

const DEFAULT_LEDGER_API_BASE_PATH = "/ledger";
const DEFAULT_USER_ID = "ledger-api-user";
const SUBMIT_AND_WAIT_RESOURCE = "/v2/commands/submit-and-wait";

type JsonRecord = Record<string, unknown>;

interface CreateCommand {
  templateId: string;
  payload: JsonRecord;
}

interface ExerciseCommand {
  templateId: string;
  contractId: string;
  choiceName: string;
  choiceArgument: JsonRecord;
}

type JsonApiCommand =
  | {
      CreateCommand: {
        templateId: string;
        createArguments: JsonRecord;
      };
    }
  | {
      ExerciseCommand: {
        templateId: string;
        contractId: string;
        choice: string;
        choiceArgument: JsonRecord;
      };
    };

interface SubmitAndWaitResult {
  commandId: string;
  response: unknown;
}

interface LedgerHttpOptions {
  basePath?: string;
  userId?: string;
}

class LedgerApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(message: string, status: number, body: string) {
    super(message);
    this.name = "LedgerApiError";
    this.status = status;
    this.body = body;
  }
}

const isUnknownInformees = (body: string): boolean => {
  try {
    const parsed = JSON.parse(body);
    const code = parsed?.code ?? parsed?.error?.code ?? parsed?.details?.[0]?.errorCodeId;
    return (
      code === "UNKNOWN_INFORMEES" ||
      (typeof body === "string" && body.includes("UNKNOWN_INFORMEES"))
    );
  } catch {
    return body.includes("UNKNOWN_INFORMEES");
  }
};

const enrichUnknownInformees = (
  baseMessage: string,
  body: string,
  actAs: readonly string[],
  userId: string,
): string => {
  if (!isUnknownInformees(body)) {
    return baseMessage;
  }

  const lines = [
    baseMessage,
    "",
    "Likely cause: the actAs party is not provisioned on the sandbox synchronizer,",
    "or the submitting user lacks actAs/readAs rights for the party.",
    "",
    `  actAs  : ${actAs.join(", ")}`,
    `  userId : ${userId}`,
    "",
    "To fix: restart the ledger dev stack to run bootstrap provisioning:",
    "  yarn dev:ledger",
    "",
    `Backend response: ${truncateResponse(body)}`,
  ];

  return lines.join("\n");
};

const asRecord = (value: unknown): JsonRecord | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as JsonRecord;
};

const asString = (value: unknown): string | null => {
  return typeof value === "string" ? value : null;
};

const asNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const truncateResponse = (body: string, maxLen = 4000): string => {
  const trimmed = body.trim();
  if (!trimmed) {
    return "<empty>";
  }
  if (trimmed.length <= maxLen) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLen - 3)}...`;
};

const normalizeBasePath = (basePath?: string): string => {
  const value = basePath ?? DEFAULT_LEDGER_API_BASE_PATH;
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

const normalizeResource = (resource: string): string => {
  return resource.startsWith("/") ? resource : `/${resource}`;
};

const generateCommandId = (): string => {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `cmd-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};

const parseCreateCommand = (commands: JsonRecord): CreateCommand | null => {
  const create = asRecord(commands.create);
  if (!create) {
    return null;
  }

  const templateId = asString(create.templateId);
  const payload = asRecord(create.payload);
  if (!templateId || !payload) {
    return null;
  }

  return { templateId, payload };
};

const parseExerciseCommand = (commands: JsonRecord): ExerciseCommand | null => {
  const exercise = asRecord(commands.exercise);
  if (!exercise) {
    return null;
  }

  const templateId = asString(exercise.templateId);
  const contractId = asString(exercise.contractId);
  const choiceName = asString(exercise.choiceName);
  const choiceArgument = asRecord(exercise.choiceArgument);

  if (!templateId || !contractId || !choiceName || !choiceArgument) {
    return null;
  }

  return { templateId, contractId, choiceName, choiceArgument };
};

const toJsonApiCommands = (commands: JsonRecord): JsonApiCommand[] => {
  const normalized: JsonApiCommand[] = [];

  const create = parseCreateCommand(commands);
  if (create) {
    normalized.push({
      CreateCommand: {
        templateId: create.templateId,
        createArguments: create.payload,
      },
    });
  }

  const exercise = parseExerciseCommand(commands);
  if (exercise) {
    normalized.push({
      ExerciseCommand: {
        templateId: exercise.templateId,
        contractId: exercise.contractId,
        choice: exercise.choiceName,
        choiceArgument: exercise.choiceArgument,
      },
    });
  }

  if (normalized.length === 0) {
    throw new Error(
      "Unsupported command payload. Expected 'commands.create' or 'commands.exercise' structure.",
    );
  }

  return normalized;
};

const parseJsonResponse = (payload: string, context: string): unknown => {
  if (!payload.trim()) {
    return {};
  }

  try {
    return JSON.parse(payload);
  } catch {
    throw new Error(`${context} returned non-JSON response: ${truncateResponse(payload)}`);
  }
};

const parseExecutedPayload = (
  response: unknown,
  commandId: string,
): { updateId: string; completionOffset: number } => {
  const body = asRecord(response) ?? {};
  const transaction = asRecord(body.transaction) ?? {};
  const payload = asRecord(body.payload) ?? {};

  const updateId =
    asString(body.updateId) ??
    asString(payload.updateId) ??
    asString(transaction.updateId) ??
    `update-${commandId}`;

  const completionOffset =
    asNumber(body.completionOffset) ??
    asNumber(payload.completionOffset) ??
    asNumber(body.offset) ??
    asNumber(transaction.offset) ??
    0;

  return {
    updateId,
    completionOffset,
  };
};

const requestLedgerApi = async (
  requestMethod: LedgerApiRequest["requestMethod"],
  resource: string,
  body: string | undefined,
  options: LedgerHttpOptions,
): Promise<{ response: string }> => {
  const basePath = normalizeBasePath(options.basePath);
  const resourcePath = `${basePath}${normalizeResource(resource)}`;
  const response = await fetch(resourcePath, {
    method: requestMethod,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body,
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new LedgerApiError(
      `Ledger API ${requestMethod} ${resource} failed with status ${response.status}: ${truncateResponse(responseText)}`,
      response.status,
      responseText,
    );
  }

  return { response: responseText };
};

// Cache resolved full party IDs keyed by userId.
const partyCache = new Map<string, string>();

/** Resolve the user's primaryParty from the Ledger API user management endpoint. */
export const resolveUserParty = async (
  userId: string,
  options: LedgerHttpOptions,
): Promise<string> => {
  const cached = partyCache.get(userId);
  if (cached) {
    return cached;
  }
  const { response } = await requestLedgerApi(
    "GET",
    `/v2/users/${encodeURIComponent(userId)}`,
    undefined,
    options,
  );
  const parsed = JSON.parse(response);
  const primaryParty: unknown = parsed?.user?.primaryParty;
  if (typeof primaryParty !== "string" || !primaryParty) {
    throw new Error(
      `User '${userId}' has no primaryParty configured. ` +
        `Ensure the bootstrap script ran successfully. Response: ${response}`,
    );
  }
  partyCache.set(userId, primaryParty);
  return primaryParty;
};

/**
 * Resolve actAs parties: if all entries contain "::" they are already fully
 * qualified Canton party IDs. Otherwise, resolve the user's primaryParty
 * from the Ledger API (which contains the full "Alice::namespace" form).
 */
const resolveActAs = async (
  actAs: readonly string[],
  userId: string,
  options: LedgerHttpOptions,
): Promise<string[]> => {
  if (actAs.length > 0 && actAs.every((p) => p.includes("::"))) {
    return [...actAs];
  }
  const fullParty = await resolveUserParty(userId, options);
  return [fullParty];
};

const submitAndWait = async (
  params: JsPrepareSubmissionRequest,
  options: LedgerHttpOptions,
): Promise<SubmitAndWaitResult> => {
  const commandsRecord = asRecord(params.commands);
  if (!commandsRecord) {
    throw new Error("Invalid commands payload: expected object.");
  }

  const commands = toJsonApiCommands(commandsRecord);
  const userId = options.userId ?? DEFAULT_USER_ID;
  const commandId = params.commandId ?? generateCommandId();
  const rawActAs = params.actAs && params.actAs.length > 0 ? params.actAs : [];
  const actAs = await resolveActAs(rawActAs, userId, options);

  const payload = {
    userId,
    commandId,
    commands,
    actAs,
    readAs: params.readAs,
    disclosedContracts: params.disclosedContracts,
    synchronizerId: params.synchronizerId,
    packageIdSelectionPreference: params.packageIdSelectionPreference,
  };

  // eslint-disable-next-line no-console
  console.debug("[ledger-http] submitAndWait request", {
    commandId,
    actAs,
    commands: JSON.stringify(commands).slice(0, 500),
  });

  let response: { response: string };
  try {
    response = await requestLedgerApi(
      "POST",
      SUBMIT_AND_WAIT_RESOURCE,
      JSON.stringify(payload),
      options,
    );
  } catch (error) {
    if (error instanceof LedgerApiError) {
      throw new LedgerApiError(
        enrichUnknownInformees(error.message, error.body, actAs, userId),
        error.status,
        error.body,
      );
    }
    throw error;
  }

  // eslint-disable-next-line no-console
  console.debug("[ledger-http] submitAndWait response", {
    commandId,
    responseLength: response.response.length,
    responsePreview: response.response.slice(0, 500),
  });

  return {
    commandId,
    response: parseJsonResponse(response.response, `Ledger API POST ${SUBMIT_AND_WAIT_RESOURCE}`),
  };
};

const hasLedgerLogChanged = createChangeGate();

const extractTemplateIdFromBody = (body: string | undefined): string | null => {
  if (!body) {
    return null;
  }

  // This is purely for log scoping, so a lightweight regex is fine.
  const match = body.match(/"templateId":"([^"]+)"/);
  return match?.[1] ?? null;
};

const parseJsonIfPossible = (input: string): unknown | null => {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
};

const collectStringFieldValues = (
  value: unknown,
  field: string,
  output: string[],
  max = 200,
): void => {
  if (output.length >= max || value === null || value === undefined) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStringFieldValues(item, field, output, max);
      if (output.length >= max) {
        return;
      }
    }
    return;
  }
  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const direct = record[field];
  if (typeof direct === "string") {
    output.push(direct);
  }

  for (const nested of Object.values(record)) {
    collectStringFieldValues(nested, field, output, max);
    if (output.length >= max) {
      return;
    }
  }
};

const findFirstScalarField = (
  value: unknown,
  fields: readonly string[],
): string | number | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findFirstScalarField(item, fields);
      if (found !== null) {
        return found;
      }
    }
    return null;
  }
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const field of fields) {
    const candidate = record[field];
    if (typeof candidate === "string" || typeof candidate === "number") {
      return candidate;
    }
  }

  for (const nested of Object.values(record)) {
    const found = findFirstScalarField(nested, fields);
    if (found !== null) {
      return found;
    }
  }

  return null;
};

const summarizeActiveContractsResponse = (
  response: string,
): { dedupeValue: unknown; payload: Record<string, unknown> } => {
  const parsed = parseJsonIfPossible(response);
  if (!parsed) {
    const preview = response.slice(0, 240);
    return {
      dedupeValue: preview,
      payload: {
        parse: "raw",
        responseLength: response.length,
        responsePreview: preview,
      },
    };
  }

  const contractIds: string[] = [];
  collectStringFieldValues(parsed, "contractId", contractIds);
  const uniqueContractIds = [...new Set(contractIds)].sort();
  const previewIds = uniqueContractIds.slice(0, 3).map(shortenContractId);

  return {
    dedupeValue: uniqueContractIds,
    payload: {
      count: uniqueContractIds.length,
      contractIds: previewIds,
      hasMore: uniqueContractIds.length > previewIds.length,
    },
  };
};

const summarizeLedgerEndResponse = (
  response: string,
): { dedupeValue: unknown; payload: Record<string, unknown> } => {
  const parsed = parseJsonIfPossible(response);
  if (!parsed) {
    const preview = response.slice(0, 240);
    return {
      dedupeValue: preview,
      payload: {
        parse: "raw",
        responseLength: response.length,
        responsePreview: preview,
      },
    };
  }

  const offset = findFirstScalarField(parsed, ["ledgerEnd", "offset", "completionOffset"]);
  return {
    dedupeValue: offset ?? "unknown",
    payload: {
      offset: offset ?? "unknown",
    },
  };
};

export async function callLedgerApi(
  params: LedgerApiRequest,
  options: LedgerHttpOptions = {},
): Promise<{ response: string }> {
  const isActiveContracts = params.resource.includes("active-contracts");
  const isLedgerEnd = params.resource.includes("ledger-end");

  const logScope = (() => {
    if (!isActiveContracts) {
      return `${params.requestMethod}:${params.resource}`;
    }

    const templateId = extractTemplateIdFromBody(params.body);
    return `${params.requestMethod}:${params.resource}:${templateId ?? "unknown-template"}`;
  })();

  if (isActiveContracts || isLedgerEnd) {
    const requestSummary = {
      templateId: isActiveContracts ? extractTemplateIdFromBody(params.body) : null,
      bodyPreview: params.body?.slice(0, 240) ?? null,
    };
    const key = `request:${logScope}`;
    if (hasLedgerLogChanged(key, requestSummary)) {
      // eslint-disable-next-line no-console
      console.debug(`[ledger-http] ${params.requestMethod} ${params.resource}`, requestSummary);
    }
  }

  const result = await requestLedgerApi(
    params.requestMethod,
    params.resource,
    params.body,
    options,
  );

  if (isActiveContracts || isLedgerEnd) {
    const responseSummary = isActiveContracts
      ? summarizeActiveContractsResponse(result.response)
      : summarizeLedgerEndResponse(result.response);
    const key = `response:${logScope}`;
    if (hasLedgerLogChanged(key, responseSummary.dedupeValue)) {
      // eslint-disable-next-line no-console
      console.debug(
        `[ledger-http] ${params.requestMethod} ${params.resource} response`,
        responseSummary.payload,
      );
    }
  }

  return result;
}

export async function prepareExecute(
  params: JsPrepareSubmissionRequest,
  options: LedgerHttpOptions = {},
): Promise<null> {
  await submitAndWait(params, options);
  return null;
}

export async function prepareExecuteAndWait(
  params: JsPrepareSubmissionRequest,
  options: LedgerHttpOptions = {},
): Promise<PrepareExecuteAndWaitResult> {
  const submission = await submitAndWait(params, options);
  return {
    tx: {
      status: "executed",
      commandId: submission.commandId,
      payload: parseExecutedPayload(submission.response, submission.commandId),
    },
  };
}
