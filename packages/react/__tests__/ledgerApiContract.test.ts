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
    expect(parseLedgerEndResponse(JSON.stringify({ offset: 12 }))).toEqual({ offset: "12" });
  });

  test("throws when offset is missing", () => {
    expect(() => parseLedgerEndResponse(JSON.stringify({ status: 401 }))).toThrow(
      "Invalid ledger end response",
    );
  });
});

describe("request body builders", () => {
  test("serializes active-contracts offset as numeric json", () => {
    const body = buildActiveContractsRequestBody("9007199254740993", {
      filtersByParty: { "alice::test": {} },
      verbose: true,
    });
    expect(body).toContain('"activeAtOffset":9007199254740993');
    expect(body).not.toContain('"activeAtOffset":"9007199254740993"');
  });

  test("serializes updates beginExclusive as numeric json", () => {
    const body = buildUpdatesFlatsRequestBody("9007199254740993", {
      includeTransactions: {
        transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
      },
    });
    expect(body).toContain('"beginExclusive":9007199254740993');
    expect(body).not.toContain('"beginExclusive":"9007199254740993"');
  });
});

describe("parseUpdatesFlatsResponse", () => {
  test("accepts large numeric offsets from JSON.parse without hard failure", () => {
    const parsed = parseUpdatesFlatsResponse(
      '{"update":[{"transaction":{"updateId":"u1","offset":9007199254740993,"events":[]}}]}',
    );

    expect(parsed.update[0]?.transaction?.updateId).toBe("u1");
    expect(parsed.update[0]?.transaction?.offset).toBe("9007199254740993");
  });
});
