import type { SpliceProvider } from "@sigilry/dapp";
import "@sigilry/dapp/browser-globals";

async function readHoldings(provider: SpliceProvider) {
  const account = await provider.request({ method: "getPrimaryAccount" });
  const ledgerEnd = await provider.request({
    method: "ledgerApi",
    params: { requestMethod: "get", resource: "/v2/state/ledger-end" },
  });

  // The proxy parses JSON numbers; reject offsets it cannot represent exactly.
  if (Array.isArray(ledgerEnd)) throw new Error("Expected a ledger-end object");
  const offset = ledgerEnd.offset;
  if (typeof offset !== "number" || !Number.isSafeInteger(offset) || offset < 0) {
    throw new Error("Ledger end must be a non-negative safe integer");
  }
  const activeAtOffset = offset;

  const response = await provider.request({
    method: "ledgerApi",
    params: {
      requestMethod: "post",
      resource: "/v2/state/active-contracts",
      body: {
        activeAtOffset,
        eventFormat: {
          verbose: true,
          filtersByParty: {
            [account.partyId]: {
              cumulative: [
                {
                  identifierFilter: {
                    InterfaceFilter: {
                      value: {
                        interfaceId:
                          "#splice-api-token-holding-v1:Splice.Api.Token.HoldingV1:Holding",
                        includeInterfaceView: true,
                        includeCreatedEventBlob: true,
                      },
                    },
                  },
                },
              ],
            },
          },
        },
      },
    },
  });

  // The active-contracts endpoint returns an array, rather than a ledger-end object.
  if (!Array.isArray(response)) throw new Error("Expected an active-contracts array");
  const current = await provider.request({ method: "getPrimaryAccount" });
  if (current.partyId !== account.partyId || current.networkId !== account.networkId) {
    throw new Error("Account or network changed; query a fresh snapshot");
  }
  return response;
}

if (!window.canton) throw new Error("Connect a Canton wallet first");
const holdings = await readHoldings(window.canton);
console.log(holdings);
