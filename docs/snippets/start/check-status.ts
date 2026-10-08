import "@sigilry/dapp/browser-globals";

export async function checkStatus() {
  if (!window.canton) {
    throw new Error("Canton provider not available");
  }

  const status = await window.canton.request({ method: "status" });
  console.log("Connected:", status.connection.isConnected);
  return status;
}
