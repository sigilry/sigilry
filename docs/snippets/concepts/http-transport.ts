import type { RequestPayload, ResponsePayload } from "@sigilry/dapp/messages";
import type { RpcTransport } from "@sigilry/dapp/transport";

export class HttpTransport implements RpcTransport {
  constructor(private readonly baseUrl: string) {}

  async submit(payload: RequestPayload): Promise<ResponsePayload> {
    const response = await fetch(`${this.baseUrl}/rpc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return (await response.json()) as ResponsePayload;
  }
}
