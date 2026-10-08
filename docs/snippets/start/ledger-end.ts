import "@sigilry/dapp/browser-globals";

if (!window.canton) throw new Error("Canton provider not available");

const ledgerEnd = await window.canton.request({
  method: "ledgerApi",
  params: {
    requestMethod: "get",
    resource: "/v2/state/ledger-end",
  },
});
console.log(ledgerEnd);
