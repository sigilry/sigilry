import { describe, expect, test } from "bun:test";
import {
  applyPrunedOffsetFloor,
  deriveRecentBeginExclusive,
  isMaximumListElementsError,
} from "../src/hooks/ledgerApiContract.js";
import { useLedgerUpdates } from "../src/hooks/useLedgerUpdates.js";
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

registerTestIsolation();

type LedgerApiParams = {
  requestMethod?: string;
  resource?: string;
  body?: Record<string, unknown>;
};

function ledgerApiCalls(
  calls: ReadonlyArray<{ method: string; params?: unknown }>,
  resource: string,
): LedgerApiParams[] {
  return calls
    .filter(
      (call) =>
        call.method === "ledgerApi" &&
        typeof call.params === "object" &&
        call.params !== null &&
        (call.params as LedgerApiParams).resource === resource,
    )
    .map((call) => call.params as LedgerApiParams);
}

describe("ledger update pruning helpers", () => {
  test("clamps beginExclusive to the latest pruned offset floor", () => {
    const body = { beginExclusive: "42" };

    expect(applyPrunedOffsetFloor(body, "100").beginExclusive).toBe("100");
    expect(applyPrunedOffsetFloor(body, "10").beginExclusive).toBe("42");
  });

  test("derives a recent begin offset with a bounded zero floor", () => {
    const body = { beginExclusive: "0" };

    expect(deriveRecentBeginExclusive(body, "1000")).toBe("900");
    expect(deriveRecentBeginExclusive(body, "75")).toBe("0");
    expect(deriveRecentBeginExclusive(body, "1000", 25)).toBe("975");
  });

  test("recognizes Canton maximum-list-elements error envelopes", () => {
    expect(
      isMaximumListElementsError({
        error: {
          code: "JSON_API_MAXIMUM_LIST_ELEMENTS_NUMBER_REACHED",
          message: "The number of matching elements exceeded the configured limit",
        },
      }),
    ).toBe(true);

    expect(isMaximumListElementsError(new Error("ledger unavailable"))).toBe(false);
  });
});

describe("useLedgerUpdates pruning behavior", () => {
  test("applies latest-pruned-offsets floor during ledger-end initialization", async () => {
    const provider = createMockProvider(({ method, params }) => {
      if (method === "status") return CONNECTED_STATUS;
      if (method === "listAccounts") return [TEST_ACCOUNT];

      if (method === "ledgerApi" && typeof params === "object" && params !== null) {
        const request = params as LedgerApiParams;
        if (request.resource === "/v2/state/ledger-end") {
          return { offset: "100" };
        }
        if (request.resource === "/v2/state/latest-pruned-offsets") {
          return { participantPrunedUpToInclusive: "150" };
        }
        if (request.resource === "/v2/updates/flats") {
          // Canton's wire shape for "no updates": empty array of chunks.
          return [];
        }
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useLedgerUpdates({ pollingInterval: 60_000 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.currentOffset).toBe("150");
    });

    expect(ledgerApiCalls(provider.calls, "/v2/state/latest-pruned-offsets")).toHaveLength(1);
  });

  test("retries maximum-list-elements responses from a recent ledger-end window", async () => {
    const provider = createMockProvider(({ method, params }) => {
      if (method === "status") return CONNECTED_STATUS;
      if (method === "listAccounts") return [TEST_ACCOUNT];

      if (method === "ledgerApi" && typeof params === "object" && params !== null) {
        const request = params as LedgerApiParams;
        if (request.resource === "/v2/state/latest-pruned-offsets") {
          return { participantPrunedUpToInclusive: "0" };
        }
        if (request.resource === "/v2/state/ledger-end") {
          return { offset: "1000" };
        }
        if (request.resource === "/v2/updates/flats") {
          const beginExclusive = request.body?.beginExclusive;
          if (beginExclusive === "0") {
            throw {
              code: "JSON_API_MAXIMUM_LIST_ELEMENTS_NUMBER_REACHED",
              message: "The number of matching elements exceeded maximum-list-elements",
            };
          }
          if (beginExclusive === "900") {
            // Canton wire shape: array of JsGetUpdatesResponse-shaped chunks,
            // each with `update.Transaction.value` per CIP-0103.
            return [
              {
                update: {
                  Transaction: {
                    value: {
                      updateId: "update-901",
                      offset: "901",
                      effectiveAt: "2026-04-20T00:00:00Z",
                      events: [],
                    },
                  },
                },
              },
            ];
          }
        }
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(
      () => useLedgerUpdates({ initialOffset: "0", pollingInterval: 60_000 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.currentOffset).toBe("0");
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.poll();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.currentOffset).toBe("901");
      expect(result.current.updates.map((update) => update.updateId)).toEqual(["update-901"]);
    });

    expect(
      ledgerApiCalls(provider.calls, "/v2/updates/flats").map((call) => call.body?.beginExclusive),
    ).toEqual(["0", "900"]);
  });

  test("propagates unrelated polling errors through parseError", async () => {
    const provider = createMockProvider(({ method, params }) => {
      if (method === "status") return CONNECTED_STATUS;
      if (method === "listAccounts") return [TEST_ACCOUNT];

      if (method === "ledgerApi" && typeof params === "object" && params !== null) {
        const request = params as LedgerApiParams;
        if (request.resource === "/v2/state/latest-pruned-offsets") {
          return { participantPrunedUpToInclusive: "0" };
        }
        if (request.resource === "/v2/updates/flats") {
          throw { code: "SESSION_EXPIRED", message: "Session expired while polling" };
        }
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(
      () => useLedgerUpdates({ initialOffset: "100", pollingInterval: 60_000 }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.currentOffset).toBe("100");
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.poll();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe("Your session has expired");
      expect(result.current.currentOffset).toBe("100");
    });

    expect(ledgerApiCalls(provider.calls, "/v2/updates/flats")).toHaveLength(1);
  });
});
