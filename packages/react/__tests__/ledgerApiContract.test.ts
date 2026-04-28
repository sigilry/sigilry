import { describe, expect, test } from "bun:test";
import {
  buildActiveContractsRequestBody,
  buildUpdatesFlatsRequestBody,
  parseLedgerEndResponse,
  parseLedgerOffsetInput,
  parseLedgerOffsetWire,
  parseUpdatesFlatsResponse,
} from "../src/hooks/ledgerApiContract.js";

describe("parseLedgerOffsetInput", () => {
  test("normalizes valid offsets", () => {
    expect(parseLedgerOffsetInput("00042")).toBe("42");
    expect(parseLedgerOffsetInput(7)).toBe("7");
    expect(parseLedgerOffsetInput(9n)).toBe("9");
  });

  test("rejects empty and whitespace offsets", () => {
    expect(() => parseLedgerOffsetInput("")).toThrow("Invalid ledger offset:");
    expect(() => parseLedgerOffsetInput("   ")).toThrow("Invalid ledger offset:");
  });

  test("rejects non-decimal or negative offsets", () => {
    expect(() => parseLedgerOffsetInput("-1")).toThrow("Invalid ledger offset:");
    expect(() => parseLedgerOffsetInput("0x10")).toThrow("Invalid ledger offset:");
    expect(() => parseLedgerOffsetInput("1e3")).toThrow("Invalid ledger offset:");
  });

  test("rejects unsafe numeric offsets", () => {
    expect(() => parseLedgerOffsetInput(9_007_199_254_740_992)).toThrow("Invalid ledger offset:");
  });
});

describe("parseLedgerOffsetWire", () => {
  test("accepts finite integer wire numbers", () => {
    expect(parseLedgerOffsetWire(12)).toBe("12");
  });
});

describe("parseLedgerEndResponse", () => {
  test("parses and normalizes offset", () => {
    expect(parseLedgerEndResponse({ offset: 12 })).toEqual({ offset: "12" });
  });

  test("throws when offset is missing", () => {
    expect(() => parseLedgerEndResponse({ status: 401 })).toThrow("Invalid ledger end response");
  });

  test("preserves max int64 offsets as strings", () => {
    expect(parseLedgerEndResponse({ offset: "9223372036854775807" })).toEqual({
      offset: "9223372036854775807",
    });
  });
});

describe("request body builders", () => {
  test("builds active-contracts bodies with normalized string offsets", () => {
    const body = buildActiveContractsRequestBody("9007199254740993", {
      filtersByParty: { "alice::test": {} },
      verbose: true,
    });
    expect(body).toEqual({
      activeAtOffset: "9007199254740993",
      eventFormat: {
        filtersByParty: { "alice::test": {} },
        verbose: true,
      },
    });
  });

  test("builds updates bodies with normalized string offsets", () => {
    const body = buildUpdatesFlatsRequestBody("9007199254740993", {
      includeTransactions: {
        transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
      },
    });
    expect(body).toEqual({
      beginExclusive: "9007199254740993",
      updateFormat: {
        includeTransactions: {
          transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
        },
      },
    });
  });
});

describe("parseUpdatesFlatsResponse", () => {
  test("accepts large string offsets from the canton CIP-0103 wire payload", () => {
    // Canton's wire shape: array of `JsGetUpdatesResponse` chunks per the
    // openapi spec at sigilry/packages/canton-json-api/api-specs/openapi.yaml.
    const parsed = parseUpdatesFlatsResponse([
      {
        update: {
          Transaction: {
            value: { updateId: "u1", offset: "9007199254740993", events: [] },
          },
        },
      },
    ]);

    expect(parsed.update[0]?.transaction?.updateId).toBe("u1");
    expect(parsed.update[0]?.transaction?.offset).toBe("9007199254740993");
  });

  test("silently skips OffsetCheckpoint / Reassignment / TopologyTransaction chunks", () => {
    // Canton emits non-Transaction chunks (e.g. OffsetCheckpoint heartbeats)
    // in the same /v2/updates/flats stream. They must not error the poll;
    // they're returned as empty entries so the caller advances offset.
    const parsed = parseUpdatesFlatsResponse([
      {
        update: {
          OffsetCheckpoint: {
            value: {
              offset: 2913,
              synchronizerTimes: [
                {
                  synchronizerId: "global-domain::1220",
                  recordTime: "2026-04-27T21:08:32.410651Z",
                },
              ],
            },
          },
        },
      },
    ]);

    expect(parsed.update).toHaveLength(1);
    expect(parsed.update[0]).toEqual({});
  });

  test("rejects the legacy speculative {update: [...]} shape we used to fake", () => {
    // No canton version emits this shape — it was a fixture-shaped fiction
    // baked into our home-rolled parser before we cross-checked the openapi
    // spec. Reject explicitly so a future regression surfaces immediately.
    expect(() =>
      parseUpdatesFlatsResponse({
        update: [{ transaction: { updateId: "u1", offset: "1", events: [] } }],
      }),
    ).toThrow(/Invalid \/v2\/updates\/flats response/);
  });
});
