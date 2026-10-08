import "@sigilry/dapp/browser-globals";

if (!window.canton) {
  throw new Error("Canton provider not available");
}
