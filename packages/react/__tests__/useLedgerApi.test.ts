import { describe, expect, test } from "bun:test";
import { zGetLedgerEndResponse } from "@sigilry/canton-json-api";
import { useLedgerApi } from "../src/hooks/useLedgerApi.js";
import {
  act,
  CONNECTED_STATUS,
  TEST_ACCOUNT,
  createHookWrapper,
  createMockProvider,
  installMockProvider,
  registerTestIsolation,
  renderHook,
  waitFor,
} from "./testUtils.js";
import { parseLedgerApiResponse } from "../src/hooks/useLedgerApi.js";

registerTestIsolation();

describe("parseLedgerApiResponse", () => {
  test("accepts array payloads and applies the caller parser", () => {
    const raw = [{ contractEntry: {} }, { offset: "123" }];
    const result = parseLedgerApiResponse(raw, (input) => {
      if (!Array.isArray(input)) {
        throw new Error("invalid shape");
      }
      return input;
    });

    expect(result.raw).toEqual(raw);
    expect(result.data).toEqual(raw);
  });

  test("accepts the unwrapped JSON object and applies caller parser", () => {
    const raw = { offset: "123" };
    const result = parseLedgerApiResponse(raw, (input) => {
      if (typeof input !== "object" || input === null || !("offset" in input)) {
        throw new Error("invalid shape");
      }
      const value = (input as { offset: unknown }).offset;
      if (typeof value !== "string") {
        throw new Error("invalid shape");
      }
      return { offset: value };
    });

    expect(result.raw).toEqual(raw);
    expect(result.data).toEqual({ offset: "123" });
  });

  test("throws on non-object payloads", () => {
    expect(() => parseLedgerApiResponse(null, (input) => input)).toThrow(
      "Invalid ledger API response",
    );
    expect(() => parseLedgerApiResponse(undefined, (input) => input)).toThrow(
      "Invalid ledger API response",
    );
  });

  test("propagates parser errors", () => {
    expect(() =>
      parseLedgerApiResponse({ offset: "abc" }, () => {
        throw new Error("invalid offset payload");
      }),
    ).toThrow("invalid offset payload");
  });

  test("preserves large int64 string values before parser runs", () => {
    const result = parseLedgerApiResponse({ offset: "9223372036854775807" }, (input) =>
      zGetLedgerEndResponse.parse(input),
    );
    expect(result.data.offset).toBe(9223372036854775807n);
  });
});

describe("useLedgerApi", () => {
  test("parses direct ledgerApi results without a response wrapper", async () => {
    installMockProvider(
      createMockProvider(({ method, params }) => {
        if (method === "status") return CONNECTED_STATUS;
        if (method === "listAccounts") return [TEST_ACCOUNT];
        if (
          method === "ledgerApi" &&
          typeof params === "object" &&
          params !== null &&
          (params as { resource?: string }).resource === "/v2/state/ledger-end"
        ) {
          return { offset: "12345" };
        }

        throw new Error(`Unhandled method: ${method}`);
      }),
    );

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(
      () =>
        useLedgerApi({
          parse: zGetLedgerEndResponse.parse,
        }),
      { wrapper: Wrapper },
    );

    let response: Awaited<ReturnType<typeof result.current.requestAsync>> | undefined;

    await act(async () => {
      response = await result.current.requestAsync({
        requestMethod: "get",
        resource: "/v2/state/ledger-end",
      });
    });

    await waitFor(() => {
      expect(result.current.data?.data.offset).toBe(12345n);
    });

    expect(response).toEqual({
      raw: { offset: "12345" },
      data: { offset: 12345n },
    });
  });
});
