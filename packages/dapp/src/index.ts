/**
 * @sigilry/dapp
 *
 * Core package for Canton dApp ↔ Extension communication.
 * Provides types, schemas, and utilities for the dApp API.
 *
 * @example
 * ```typescript
 * import { WalletEvent, SpliceMessage, isSpliceMessage } from '@sigilry/dapp/messages'
 * import { createCantonClient, createCantonServer } from '@sigilry/dapp/rpc'
 * import { WindowTransport } from '@sigilry/dapp/transport'
 * import { SpliceProviderBase } from '@sigilry/dapp/provider'
 * import { CANTON_DAPP_API_VERSION } from '@sigilry/dapp'
 * ```
 */

/**
 * Canton dApp API version.
 * Used by both the client SDK and the API gateway to ensure version consistency.
 */
export const CANTON_DAPP_API_VERSION = "0.1.0";

// Re-export everything from submodules
export * from "./messages/index.js";
export * from "./provider/index.js";
export * from "./rpc/index.js";
export * from "./transport/index.js";

// Note: Generated schemas should be imported directly:
// import * as schemas from '@sigilry/dapp/schemas'
