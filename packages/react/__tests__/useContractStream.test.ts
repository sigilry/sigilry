import { describe, expect, test } from "bun:test";
import { useContractStream } from "../src/hooks/useContractStream.js";
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

type LedgerApiParams = {
  requestMethod?: string;
  resource?: string;
  body?: Record<string, unknown>;
};

describe("useContractStream", () => {
  test("floors the live-update offset when the active-contracts snapshot offset was pruned", async () => {
    const provider = createMockProvider(({ method, params }) => {
      if (method === "status") return CONNECTED_STATUS;
      if (method === "listAccounts") return [TEST_ACCOUNT];

      if (method === "ledgerApi" && typeof params === "object" && params !== null) {
        const request = params as LedgerApiParams;
        if (request.resource === "/v2/state/ledger-end") {
          return { offset: "50" };
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
                    observers: [],
                  },
                },
              },
            },
          ];
        }
        if (request.resource === "/v2/state/latest-pruned-offsets") {
          return { participantPrunedUpToInclusive: "80" };
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
    const { result } = renderHook(() => useContractStream({ pollingInterval: 60_000 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.count).toBe(1);
      expect(result.current.offset).toBe("80");
      expect(result.current.contracts[0]?.contractId).toBe("contract-1");
    });
  });
});
