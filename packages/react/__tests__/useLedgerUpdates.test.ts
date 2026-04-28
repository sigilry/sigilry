import { describe, expect, test } from "bun:test";
import { buildUpdatesFlatsRequestBody } from "../src/hooks/ledgerApiContract.js";
import { selectLatestOffset } from "../src/hooks/useLedgerUpdates.js";

describe("buildUpdatesFlatsRequestBody", () => {
  test("builds an object body with a normalized offset string", () => {
    const body = buildUpdatesFlatsRequestBody("0", {
      includeTransactions: {
        transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
      },
    });

    expect(body.beginExclusive).toBe("0");
    expect(body.updateFormat).toEqual({
      includeTransactions: {
        transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
      },
    });
  });

  test("preserves full long precision for large offsets", () => {
    const body = buildUpdatesFlatsRequestBody("9007199254740993", {
      includeTransactions: {
        transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
      },
    });

    expect(body.beginExclusive).toBe("9007199254740993");
  });

  test("serializes bigint offsets as quoted decimal strings in JSON", () => {
    const json = JSON.stringify(
      buildUpdatesFlatsRequestBody(2n ** 60n, {
        includeTransactions: {
          transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
        },
      }),
    );

    expect(json).toContain('"beginExclusive":"1152921504606846976"');
  });

  test("throws for invalid offsets", () => {
    expect(() =>
      buildUpdatesFlatsRequestBody("not-a-number", {
        includeTransactions: {
          transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
        },
      }),
    ).toThrow("Invalid ledger offset: not-a-number");
  });

  test("throws for empty offset", () => {
    expect(() =>
      buildUpdatesFlatsRequestBody("", {
        includeTransactions: {
          transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
        },
      }),
    ).toThrow("Invalid ledger offset:");
  });

  test("throws for whitespace-only offset", () => {
    expect(() =>
      buildUpdatesFlatsRequestBody("   ", {
        includeTransactions: {
          transactionShape: "TRANSACTION_SHAPE_ACS_DELTA",
        },
      }),
    ).toThrow("Invalid ledger offset:");
  });
});

describe("selectLatestOffset", () => {
  test("returns undefined for empty updates", () => {
    expect(selectLatestOffset([])).toBeUndefined();
  });

  test("selects the numerically highest offset for large ledger values", () => {
    const latest = selectLatestOffset([
      { offset: "9007199254740993" },
      { offset: "9007199254740994" },
      { offset: "9007199254740992" },
    ]);
    expect(latest).toBe("9007199254740994");
  });
});
