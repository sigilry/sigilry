import { describe, expect, test } from "bun:test";
import { useActiveContracts } from "../src/hooks/useActiveContracts.js";
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

describe("useActiveContracts", () => {
  test("surfaces ledger-end probe failures instead of querying with offset 0", async () => {
    const provider = createMockProvider(({ method, params }) => {
      if (method === "status") return CONNECTED_STATUS;
      if (method === "listAccounts") return [TEST_ACCOUNT];

      if (method === "ledgerApi" && typeof params === "object" && params !== null) {
        const request = params as { resource?: string };
        if (request.resource === "/v2/state/ledger-end") {
          throw new Error("ledger-end unavailable");
        }
        if (request.resource === "/v2/state/active-contracts") {
          throw new Error("active-contracts should not run after ledger-end failure");
        }
      }

      throw new Error(`Unhandled method: ${method}`);
    });

    installMockProvider(provider);

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useActiveContracts(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isError).toBe(true);
      expect(result.current.error?.message).toBe("ledger-end unavailable");
      expect(result.current.data).toEqual([]);
      expect(result.current.rawData).toBeUndefined();
      expect(result.current.offset).toBeUndefined();
    });

    const activeContractsCalls = provider.calls.filter(
      (call) =>
        call.method === "ledgerApi" &&
        typeof call.params === "object" &&
        call.params !== null &&
        (call.params as { resource?: string }).resource === "/v2/state/active-contracts",
    );

    expect(activeContractsCalls).toHaveLength(0);
  });
});
