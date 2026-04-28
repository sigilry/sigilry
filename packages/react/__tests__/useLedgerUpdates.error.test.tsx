import { describe, expect, test } from "bun:test";
import { useLedgerUpdates } from "../src/hooks/useLedgerUpdates.js";
import {
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

describe("useLedgerUpdates error handling", () => {
  test("surfaces ledger-end request failures instead of silently stalling polling", async () => {
    const provider = createMockProvider(({ method, params }) => {
      if (method === "status") return CONNECTED_STATUS;
      if (method === "listAccounts") return [TEST_ACCOUNT];

      if (method === "ledgerApi" && typeof params === "object" && params !== null) {
        const request = params as { resource?: string };
        if (request.resource === "/v2/state/ledger-end") {
          throw new Error("ledger-end unavailable");
        }
        if (request.resource === "/v2/updates/flats") {
          throw new Error("updates polling should not start after init failure");
        }
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useLedgerUpdates({ pollingInterval: 10 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe("ledger-end unavailable");
      expect(result.current.currentOffset).toBeUndefined();
      expect(result.current.connectionStatus).toBe("error");
      expect(result.current.updates).toEqual([]);
    });

    const updateCalls = provider.calls.filter(
      (call) =>
        call.method === "ledgerApi" &&
        typeof call.params === "object" &&
        call.params !== null &&
        (call.params as { resource?: string }).resource === "/v2/updates/flats",
    );

    expect(updateCalls).toHaveLength(0);
  });

  test("surfaces malformed ledger-end responses instead of reporting connected", async () => {
    const provider = createMockProvider(({ method, params }) => {
      if (method === "status") return CONNECTED_STATUS;
      if (method === "listAccounts") return [TEST_ACCOUNT];

      if (method === "ledgerApi" && typeof params === "object" && params !== null) {
        const request = params as { resource?: string };
        if (request.resource === "/v2/state/ledger-end") {
          return { nope: "missing offset" };
        }
        if (request.resource === "/v2/updates/flats") {
          throw new Error("updates polling should not start after malformed init");
        }
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useLedgerUpdates({ pollingInterval: 10 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe("Invalid ledger end response");
      expect(result.current.currentOffset).toBeUndefined();
      expect(result.current.connectionStatus).toBe("error");
    });
  });
});
