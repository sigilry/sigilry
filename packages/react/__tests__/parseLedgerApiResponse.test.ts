import { describe, expect, test } from "bun:test";
import { parseLedgerApiResponse } from "../src/hooks/useLedgerApi.js";

describe("parseLedgerApiResponse", () => {
  test("returns array payloads without throwing", () => {
    const payload = [{ contractEntry: {} }];

    expect(parseLedgerApiResponse(payload, (input) => input)).toEqual({
      raw: payload,
      data: payload,
    });
  });

  test("returns object payloads without changing them", () => {
    const payload = { foo: 1 };

    expect(parseLedgerApiResponse(payload, (input) => input)).toEqual({
      raw: payload,
      data: payload,
    });
  });

  test("throws on null payloads with the current error", () => {
    expect(() => parseLedgerApiResponse(null, (input) => input)).toThrow(
      "Invalid ledger API response",
    );
  });

  test("throws on undefined payloads with the current error", () => {
    expect(() => parseLedgerApiResponse(undefined, (input) => input)).toThrow(
      "Invalid ledger API response",
    );
  });

  test("passes mixed-object arrays through the identity mapper without mutation", () => {
    const payload = [{ contractEntry: {} }, { offset: "123" }, { nested: { ok: true } }];

    const result = parseLedgerApiResponse(payload, (input) => input);

    expect(result.raw).toBe(payload);
    expect(result.data).toBe(payload);
  });
});
