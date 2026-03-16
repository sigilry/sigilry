import { describe, expect, test } from "bun:test";
import { parseLedgerEndResponse } from "../src/hooks/useLedgerEnd.js";

describe("parseLedgerEndResponse", () => {
  test("converts numeric offsets to strings", () => {
    const response = JSON.stringify({ offset: 12345 });
    expect(parseLedgerEndResponse(response)).toEqual({ offset: "12345" });
  });

  test("throws when offset is missing", () => {
    const response = JSON.stringify({ status: 401, error: "unauthorized" });
    expect(() => parseLedgerEndResponse(response)).toThrow("Invalid ledger end response");
  });
});
