declare function verifySendMessage(
  message: string,
  signatureHex: string,
  publicKeyBase64: string,
): Promise<boolean>;
// ---cut---
import "@sigilry/dapp/browser-globals";

if (!window.canton) throw new Error("Connect Send Connect first");
const account = await window.canton.request({ method: "getPrimaryAccount" });
const message = "Example message for signature verification";
const result = await window.canton.request({
  method: "signMessage",
  params: { message },
});
if (result.signingAlgorithmSpec !== undefined && result.signingAlgorithmSpec !== "ecdsa-sha256") {
  throw new Error("This verifier requires ECDSA P-256/SHA-256");
}
if (result.format !== undefined && result.format !== "der") {
  throw new Error("This verifier requires DER signatures");
}
if (result.encoding !== undefined && result.encoding !== "hex") {
  throw new Error("This verifier requires hex signatures");
}
const current = await window.canton.request({ method: "getPrimaryAccount" });
if (
  current.partyId !== account.partyId ||
  current.publicKey !== account.publicKey ||
  current.networkId !== account.networkId
) {
  throw new Error("Account changed during signing; request a fresh signature");
}
const valid = await verifySendMessage(message, result.signature, account.publicKey);
console.log({ valid });
