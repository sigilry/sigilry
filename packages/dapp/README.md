# @sigilry/dapp

Core package for Canton dApp-to-extension communication. Provides types, schemas, and utilities implementing the [Splice Wallet JSON-RPC dApp API](https://github.com/hyperledger-labs/splice-wallet-kernel).

## Installation

```bash
yarn add @sigilry/dapp
```

## Overview

This package provides the building blocks for dApp ↔ wallet extension communication:

- **SpliceProvider Interface**: EIP-1193-style provider API
- **Message Types**: Typed events and schemas for JSON-RPC messaging
- **Transport Layer**: Window postMessage transport implementation
- **RPC Utilities**: Client/server factories with error handling
- **Zod Schemas**: Runtime validation generated from OpenRPC specs

## Usage

### dApp Integration

```typescript
import { SpliceProviderBase, WindowTransport } from "@sigilry/dapp";

// Use the injected provider
if (window.canton) {
  const status = await window.canton.request({ method: "status" });
  console.log("Connected:", status.isConnected);
}
```

### Extension Development

```typescript
import { createCantonServer, WalletEvent, isSpliceMessage, jsonRpcResponse } from "@sigilry/dapp";

// Create RPC server with handlers
const server = createCantonServer({
  status: async () => ({
    kernel: { id: "send-extension", clientType: "browser" },
    isConnected: true,
    isNetworkConnected: true,
  }),
  connect: async () => {
    /* ... */
  },
  // ... other handlers
});

// Handle incoming messages
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isSpliceMessage(message)) return false;

  if (message.type === WalletEvent.SPLICE_WALLET_REQUEST) {
    server.handleRequest(message.request.method, message.request.params).then((result) =>
      sendResponse({
        type: WalletEvent.SPLICE_WALLET_RESPONSE,
        response: jsonRpcResponse(message.request.id, result),
      }),
    );
    return true; // async response
  }
});
```

### Custom Provider Implementation

```typescript
import { SpliceProviderBase, WindowTransport } from "@sigilry/dapp";

class MyProvider extends SpliceProviderBase {
  private transport: WindowTransport;

  constructor() {
    super();
    this.transport = new WindowTransport(window, { timeout: 30000 });
  }

  async request<T>(args: { method: string; params?: unknown }): Promise<T> {
    const response = await this.transport.submit(args);
    if ("error" in response) throw response.error;
    return response.result as T;
  }
}
```

## API Reference

### Exports

```typescript
// Main entry point
import {
  WalletEvent,
  SpliceProviderBase,
  WindowTransport,
  createCantonServer,
  createCantonClient,
  isSpliceMessage,
  jsonRpcRequest,
  jsonRpcResponse,
  RpcErrorCode,
  rpcError,
} from "@sigilry/dapp";

// Submodule imports
import { WalletEvent, isSpliceMessage } from "@sigilry/dapp/messages";
import { SpliceProviderBase } from "@sigilry/dapp/provider";
import { createCantonServer, rpcError } from "@sigilry/dapp/rpc";
import { WindowTransport } from "@sigilry/dapp/transport";
import * as schemas from "@sigilry/dapp/schemas";
```

### SpliceProvider Interface

```typescript
interface SpliceProvider {
  request<T>(args: { method: string; params?: unknown }): Promise<T>;
  on(event: string, listener: Function): SpliceProvider;
  emit(event: string, ...args: unknown[]): boolean;
  removeListener(event: string, listener: Function): SpliceProvider;
}

interface ExtendedSpliceProvider extends SpliceProvider {
  isConnected(): boolean;
  removeAllListeners(event?: string): SpliceProvider;
  listenerCount(event: string): number;
}
```

### WalletEvent Enum

```typescript
enum WalletEvent {
  SPLICE_WALLET_REQUEST = "SPLICE_WALLET_REQUEST",
  SPLICE_WALLET_RESPONSE = "SPLICE_WALLET_RESPONSE",
  SPLICE_WALLET_EXT_READY = "SPLICE_WALLET_EXT_READY",
  SPLICE_WALLET_EXT_ACK = "SPLICE_WALLET_EXT_ACK",
  SPLICE_WALLET_EXT_OPEN = "SPLICE_WALLET_EXT_OPEN",
  SPLICE_WALLET_IDP_AUTH_SUCCESS = "SPLICE_WALLET_IDP_AUTH_SUCCESS",
}
```

### RPC Methods

| Method                  | Params                       | Result                           | Description                                             |
| ----------------------- | ---------------------------- | -------------------------------- | ------------------------------------------------------- |
| `status`                | none                         | `StatusEvent`                    | Get connection status                                   |
| `connect`               | none                         | `StatusEvent`                    | Connect and get status (token in `session.accessToken`) |
| `disconnect`            | none                         | `null`                           | Disconnect session                                      |
| `getActiveNetwork`      | none                         | `Network`                        | Get active network                                      |
| `listAccounts`          | none                         | `Wallet[]`                       | Get authorized accounts                                 |
| `getPrimaryAccount`     | none                         | `Wallet`                         | Get the primary account                                 |
| `prepareExecute`        | `JsPrepareSubmissionRequest` | `null`                           | Prepare, sign, and execute transaction                  |
| `prepareExecuteAndWait` | `JsPrepareSubmissionRequest` | `{ tx: TxChangedExecutedEvent }` | Execute transaction and wait for completion             |
| `signMessage`           | `{ message: string }`        | `{ signature: string }`          | Sign an arbitrary message                               |
| `ledgerApi`             | `LedgerApiRequest`           | `{ response: string }`           | Proxy JSON-API                                          |
| `accountsChanged`       | none                         | `AccountsChangedEvent`           | Subscribe to account changes                            |
| `txChanged`             | none                         | `TxChangedEvent`                 | Subscribe to transaction changes                        |

### RPC Error Codes

```typescript
const RpcErrorCode = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // EIP-1193 provider errors
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,

  // EIP-1474 server errors
  INVALID_INPUT: -32000,
  RESOURCE_NOT_FOUND: -32001,
  RESOURCE_UNAVAILABLE: -32002,
  TRANSACTION_REJECTED: -32003,
  METHOD_NOT_SUPPORTED: -32004,
  LIMIT_EXCEEDED: -32005,
};
```

### WindowTransport Options

```typescript
interface TransportOptions {
  timeout?: number; // Request timeout in ms (default: 30000)
  targetOrigin?: string; // postMessage target origin (default: '*')
}
```

## Generated Schemas

Zod schemas are generated from OpenRPC specifications:

```typescript
import {
  StatusEventSchema,
  JsPrepareSubmissionRequestSchema,
  TxChangedEventSchema,
  type StatusEvent,
  type JsPrepareSubmissionRequest,
} from "@sigilry/dapp/schemas";

// Validate incoming data
const parsed = StatusEventSchema.parse(data);
```

Regenerate schemas after spec changes:

```bash
yarn workspace @sigilry/dapp codegen
```

## Project Structure

```
packages/dapp/
├── api-specs/
│   ├── openrpc-dapp-api.json    # Splice dApp API spec
│   └── openrpc-user-api.json    # User API spec (referenced)
├── scripts/
│   └── codegen.ts               # Schema generation script
├── src/
│   ├── generated/
│   │   └── schemas.ts           # Generated Zod schemas
│   ├── messages/
│   │   ├── events.ts            # WalletEvent enum
│   │   ├── schemas.ts           # Message type validators
│   │   └── index.ts
│   ├── provider/
│   │   ├── interface.ts         # SpliceProvider interface
│   │   ├── base.ts              # SpliceProviderBase class
│   │   └── index.ts
│   ├── rpc/
│   │   ├── client.ts            # RPC client factory
│   │   ├── server.ts            # RPC server factory
│   │   ├── errors.ts            # Error codes and helpers
│   │   └── index.ts
│   ├── transport/
│   │   ├── types.ts             # Transport interfaces
│   │   ├── window.ts            # WindowTransport class
│   │   └── index.ts
│   └── index.ts                 # Main exports
└── package.json
```

## Development

```bash
# Build package
yarn workspace @sigilry/dapp build

# Run tests
yarn workspace @sigilry/dapp test

# Type check
yarn workspace @sigilry/dapp typecheck

# Regenerate schemas
yarn workspace @sigilry/dapp codegen
```

## Reference Implementation

This package follows the [splice-wallet-kernel](https://github.com/hyperledger-labs/splice-wallet-kernel) specification:

- **dApp API Spec**: Based on `core/dapp-api/openrpc.json`
- **SpliceProvider Interface**: Compatible with `core/splice-provider/src/SpliceProvider.ts`
- **WalletEvent Types**: Aligned with `core/types/src/index.ts`

## Spec alignment

Sigilry tracks the splice-wallet-kernel OpenRPC specs as the canonical source. CIP-0103 states: "The ground truth for the dApp API is maintained in the Splice Wallet repository in a machine-readable form." The CIP-0103 text is the conceptual standard; differences between the CIP text and the OpenRPC JSON are expected as the spec evolves.

## Related

- **Send Extension**: `apps/webext/` - Browser extension using this package
- **Linear Issues**: SEND-78 (scaffold), SEND-77 (implementation)
