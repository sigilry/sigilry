import { describe, expect, test } from "bun:test";
import { zGetLedgerEndResponse } from "@sigilry/canton-json-api";
import { parseLedgerApiResponse } from "../src/hooks/useLedgerApi.js";

describe("parseLedgerApiResponse", () => {
  test("parses json and applies caller parser", () => {
    const result = parseLedgerApiResponse('{"offset":123}', (input) => {
      if (typeof input !== "object" || input === null || !("offset" in input)) {
        throw new Error("invalid shape");
      }
      const value = (input as { offset: unknown }).offset;
      if (typeof value !== "number") {
        throw new Error("invalid shape");
      }
      return { offset: String(value) };
    });

    expect(result.raw).toBe('{"offset":123}');
    expect(result.data).toEqual({ offset: "123" });
  });

  test("throws on invalid json", () => {
    expect(() => parseLedgerApiResponse("{", (input) => input)).toThrow(
      "Invalid ledger API JSON response",
    );
  });

  test("propagates parser errors", () => {
    expect(() =>
      parseLedgerApiResponse('{"offset":"abc"}', () => {
        throw new Error("invalid offset payload");
      }),
    ).toThrow("invalid offset payload");
  });

  test("preserves large int64 values before parser runs", () => {
    const result = parseLedgerApiResponse(
      '{"offset":9007199254740993}',
      zGetLedgerEndResponse.parse,
    );
    expect(result.data.offset).toBe(9007199254740993n);
  });
});
