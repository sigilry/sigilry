import { SpliceProviderBase } from "../provider/base.js";
import type { SpliceProvider } from "../provider/interface.js";
import type { RpcMethodName, TypedRequestPayload, TypedResult } from "../provider/typed-request.js";
import type { TransportOptions } from "../transport/types.js";
import { WindowTransport } from "../transport/window.js";
import type { SpliceAnnounceDetail } from "./types.js";

type RequestParams = Record<string, unknown> | unknown[];

class WindowSpliceProvider extends SpliceProviderBase {
  private readonly transport: WindowTransport;

  constructor(win: Window, detail: SpliceAnnounceDetail, opts: TransportOptions = {}) {
    super();
    this.transport = new WindowTransport(win, { target: detail.target, ...opts });
    this.attachEventTransport(this.transport);
  }

  request = async <M extends RpcMethodName>(
    payload: TypedRequestPayload<M>,
  ): Promise<TypedResult<M>> => {
    const response = await this.transport.submit(
      "params" in payload && payload.params !== undefined
        ? { method: payload.method, params: payload.params as RequestParams }
        : { method: payload.method },
    );

    if ("error" in response) {
      throw response.error;
    }

    return response.result as TypedResult<M>;
  };
}

export function createProvider(
  detail: SpliceAnnounceDetail,
  opts: TransportOptions = {},
): SpliceProvider {
  if (typeof window === "undefined") {
    throw new Error("createProvider requires a browser window");
  }

  return new WindowSpliceProvider(window, detail, opts);
}
