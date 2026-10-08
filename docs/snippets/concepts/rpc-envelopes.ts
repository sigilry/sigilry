import type { JsonRpcRequest, JsonRpcResponse } from "@sigilry/dapp/messages";

const request: JsonRpcRequest = {
  jsonrpc: "2.0",
  id: "request-id",
  method: "status",
};

const success: JsonRpcResponse = {
  jsonrpc: "2.0",
  id: "request-id",
  result: {
    /* method result */
  },
};

const failure: JsonRpcResponse = {
  jsonrpc: "2.0",
  id: "request-id",
  error: { code: -32601, message: "Method not found" },
};
