import "@sigilry/dapp/browser-globals";

export async function connectAndListAccounts() {
  if (!window.canton) {
    throw new Error("Canton provider not available");
  }

  const status = await window.canton.request({ method: "status" });
  if (!status.connection.isConnected) {
    await window.canton.request({ method: "connect" });
  }

  const accounts = await window.canton.request({ method: "listAccounts" });
  console.log("Accounts:", accounts);
  return accounts;
}
