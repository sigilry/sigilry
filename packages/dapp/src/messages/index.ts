export { WalletEvent } from "./events.js";
// Runtime schemas for extension communication
export {
  type ApprovalBridgeMessage,
  type ApprovalRequestData,
  type ApprovalResult,
  isApprovalBridgeMessage,
  isRuntimeMessage,
  type RuntimeMessage,
} from "./runtime-schemas.js";
export {
  ErrorResponse,
  isSpliceMessage,
  isSpliceMessageEvent,
  JsonRpcMeta,
  JsonRpcRequest,
  JsonRpcResponse,
  // Factories
  jsonRpcRequest,
  jsonRpcResponse,
  // JSON-RPC types
  RequestPayload,
  ResponsePayload,
  RpcError,
  SpliceMessage,
  // Type guards
  type SpliceMessageEvent,
  SpliceWalletExtAckMessage,
  SpliceWalletExtOpenMessage,
  SpliceWalletExtReadyMessage,
  SpliceWalletIdpAuthSuccessMessage,
  // Message types
  SpliceWalletRequestMessage,
  SpliceWalletResponseMessage,
  SuccessResponse,
} from "./schemas.js";
