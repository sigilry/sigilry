import type { RpcTransport as Published } from "@sigilry/dapp/transport";
import type { Equal } from "../support/type-equal";

true satisfies Equal<RpcTransport, Published>;
// ---cut---
import type { RequestPayload, ResponsePayload } from "@sigilry/dapp/messages";

export interface RpcTransport {
  submit(payload: RequestPayload): Promise<ResponsePayload>;
}
