import { describe, expect, test } from "bun:test";
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

describe("useLedgerUpdates integration", () => {
  test("initializes from ledger-end and polls updates from direct CIP-0103 payloads", async () => {
    const onUpdateCalls: unknown[] = [];

    installMockProvider(
      createMockProvider(({ method, params }) => {
        if (method === "status") return CONNECTED_STATUS;
        if (method === "listAccounts") return [TEST_ACCOUNT];

        if (method === "ledgerApi" && typeof params === "object" && params !== null) {
          const request = params as { resource?: string };
          if (request.resource === "/v2/state/ledger-end") {
            return { offset: "100" };
          }
          if (request.resource === "/v2/updates/flats") {
            // Canton's wire shape: array of { update: { <Discriminator>:
            // { value: {...} } } } chunks, per
            // @sigilry/canton-json-api/types.gen.ts (`JsGetUpdatesResponse[]`).
            return [
              {
                update: {
                  Transaction: {
                    value: {
                      updateId: "update-1",
                      commandId: "command-1",
                      offset: "101",
                      effectiveAt: "2026-04-15T00:00:00Z",
                      events: [
                        {
                          CreatedEvent: {
                            value: {
                              contractId: "contract-1",
                              templateId: "Splice.Wallet.Payment:TransferPreapproval",
                              createArgument: { owner: TEST_ACCOUNT.partyId },
                              signatories: [TEST_ACCOUNT.partyId],
                              observers: [],
                            },
                          },
                        },
                      ],
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
    const { result } = renderHook(
      () =>
        useLedgerUpdates({
          onUpdate: (updates) => {
            onUpdateCalls.push(updates);
          },
          pollingInterval: 60_000,
        }),
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
      expect(result.current.updates).toEqual([
        {
          updateId: "update-1",
          commandId: "command-1",
          offset: "101",
          effectiveAt: "2026-04-15T00:00:00Z",
          events: [
            {
              type: "created",
              contractId: "contract-1",
              templateId: "Splice.Wallet.Payment:TransferPreapproval",
              payload: { owner: TEST_ACCOUNT.partyId },
              signatories: [TEST_ACCOUNT.partyId],
              observers: [],
            },
          ],
        },
      ]);
      expect(result.current.currentOffset).toBe("101");
    });

    expect(onUpdateCalls).toEqual([
      [
        {
          updateId: "update-1",
          commandId: "command-1",
          offset: "101",
          effectiveAt: "2026-04-15T00:00:00Z",
          events: [
            {
              type: "created",
              contractId: "contract-1",
              templateId: "Splice.Wallet.Payment:TransferPreapproval",
              payload: { owner: TEST_ACCOUNT.partyId },
              signatories: [TEST_ACCOUNT.partyId],
              observers: [],
            },
          ],
        },
      ],
    ]);
  });
});
