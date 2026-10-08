import "@sigilry/dapp/browser-globals";
import { RpcClientError } from "@sigilry/dapp";

async function getStatus() {
  if (!window.canton) throw new Error("No Canton wallet injected");
  try {
    return await window.canton.request({ method: "status" });
  } catch (err) {
    const parsed = RpcClientError.fromError(err);
    console.error(parsed.code, parsed.message);
    throw parsed;
  }
}

getStatus();
