import { describe, expect, test } from "bun:test";
import { useLedgerEnd } from "../src/hooks/useLedgerEnd.js";
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

describe("useLedgerEnd integration", () => {
  test("reads the offset from the direct CIP-0103 ledgerApi payload", async () => {
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
    const { result } = renderHook(() => useLedgerEnd(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toBe("12345");
      expect(result.current.rawData).toEqual({ offset: "12345" });
    });
  });
});
