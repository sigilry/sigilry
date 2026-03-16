/**
 * Wallet message event types for dApp ↔ Extension communication.
 *
 * These events define the protocol for:
 * - JSON-RPC request/response flow
 * - Extension discovery handshake
 * - Auth success notifications
 */
export enum WalletEvent {
  /** dApp sends JSON-RPC request to extension */
  SPLICE_WALLET_REQUEST = "SPLICE_WALLET_REQUEST",
  /** Extension sends JSON-RPC response back to dApp */
  SPLICE_WALLET_RESPONSE = "SPLICE_WALLET_RESPONSE",
  /** dApp checks if extension is loaded (discovery) */
  SPLICE_WALLET_EXT_READY = "SPLICE_WALLET_EXT_READY",
  /** Extension acknowledges it's ready */
  SPLICE_WALLET_EXT_ACK = "SPLICE_WALLET_EXT_ACK",
  /** Request to open wallet UI (e.g., for signing) */
  SPLICE_WALLET_EXT_OPEN = "SPLICE_WALLET_EXT_OPEN",
  /** IDP auth completed successfully */
  SPLICE_WALLET_IDP_AUTH_SUCCESS = "SPLICE_WALLET_IDP_AUTH_SUCCESS",
}
