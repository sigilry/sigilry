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

describe("useActiveContracts integration", () => {
  test("consumes direct ledgerApi objects for ledger-end and active-contracts", async () => {
    installMockProvider(
      createMockProvider(({ method, params }) => {
        if (method === "status") return CONNECTED_STATUS;
        if (method === "listAccounts") return [TEST_ACCOUNT];

        if (method === "ledgerApi" && typeof params === "object" && params !== null) {
          const request = params as { resource?: string };
          if (request.resource === "/v2/state/ledger-end") {
            return { offset: "42" };
          }
          if (request.resource === "/v2/state/active-contracts") {
            return [
              {
                contractEntry: {
                  JsActiveContract: {
                    createdEvent: {
                      contractId: "contract-1",
                      templateId: "Splice.Wallet.Payment:TransferPreapproval",
                      createArgument: { owner: TEST_ACCOUNT.partyId },
                      signatories: [TEST_ACCOUNT.partyId],
                      observers: ["observer::1"],
                      createdAt: "2026-04-15T00:00:00Z",
                    },
                  },
                },
              },
            ];
          }
        }

        throw new Error(`Unhandled method: ${method}`);
      }),
    );

    const { Wrapper } = createHookWrapper();
    const { result } = renderHook(() => useActiveContracts(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual([
        {
          contractId: "contract-1",
          templateId: "Splice.Wallet.Payment:TransferPreapproval",
          payload: { owner: TEST_ACCOUNT.partyId },
          createdAt: "2026-04-15T00:00:00Z",
          signatories: [TEST_ACCOUNT.partyId],
          observers: ["observer::1"],
        },
      ]);
      expect(result.current.offset).toBe("42");
    });
  });
});
