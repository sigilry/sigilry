# @sigilry/dapp

Core package for [CIP-103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)-compliant dApp ↔ wallet extension communication on Canton Network. Provides the typed `SpliceProvider` interface, JSON-RPC client/server, transports, and Zod schemas generated from the CIP-103 OpenRPC specification.

The CIP-103 OpenRPC machine-readable spec is maintained upstream in [`hyperledger-labs/splice-wallet-kernel`](https://github.com/hyperledger-labs/splice-wallet-kernel) and vendored into `packages/dapp/api-specs/openrpc-dapp-api.json`; per CIP-103 §2 the OpenRPC JSON is the ground truth where the prose and the schema diverge.

## Installation

```bash
yarn add @sigilry/dapp
```

## Overview

This package provides the building blocks for dApp ↔ wallet extension communication:

- **SpliceProvider Interface**: CIP-103 dApp API surface (request/on/removeListener — the EIP-1193 object shape that CIP-103 adopts)
- **Message Types**: Typed events and schemas for the CIP-103 JSON-RPC envelope
- **Transport Layer**: Window postMessage transport implementation
- **RPC Utilities**: Client/server factories with CIP-103-aligned error codes
- **Zod Schemas**: Runtime validation generated from the CIP-103 OpenRPC spec

## Usage

### dApp Integration

```typescript
import { SpliceProviderBase, WindowTransport } from "@sigilry/dapp";

// Use the injected provider
if (window.canton) {
  const status = await window.canton.request({ method: "status" });
  console.log("Connected:", status.connection.isConnected);
}
```

### Extension Development

```typescript
import { createCantonServer, WalletEvent, isSpliceMessage, jsonRpcResponse } from "@sigilry/dapp";

// Create RPC server with handlers
const server = createCantonServer({
  status: async () => ({
    provider: { id: "send-extension", providerType: "browser" },
    connection: { isConnected: true, isNetworkConnected: true },
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

| Method                  | Params                       | Result                                 | Description                                                                                   |
| ----------------------- | ---------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `status`                | none                         | `StatusEvent`                          | Get connection status                                                                         |
| `connect`               | none                         | `ConnectResult`                        | Connect and report whether the wallet authorized access                                       |
| `disconnect`            | none                         | `null`                                 | Disconnect session                                                                            |
| `isConnected`           | none                         | `ConnectResult`                        | Check whether the wallet is connected                                                         |
| `getActiveNetwork`      | none                         | `Network`                              | Get active network                                                                            |
| `listAccounts`          | none                         | `Wallet[]`                             | Get authorized accounts                                                                       |
| `getPrimaryAccount`     | none                         | `Wallet`                               | Get the primary account                                                                       |
| `prepareExecute`        | `JsPrepareSubmissionRequest` | `null`                                 | Prepare, sign, and execute transaction                                                        |
| `prepareExecuteAndWait` | `JsPrepareSubmissionRequest` | `{ tx: TxChangedExecutedEvent }`       | Execute transaction and wait for completion                                                   |
| `signMessage`           | `{ message: string }`        | `{ signature: string }`                | Sign an arbitrary message                                                                     |
| `ledgerApi`             | `LedgerApiRequest`           | `Record<string, unknown> \| unknown[]` | Returns the Canton Ledger API JSON response as an object or array, depending on the endpoint. |
| `accountsChanged`       | none                         | `AccountsChangedEvent`                 | Subscribe to account changes                                                                  |
| `txChanged`             | none                         | `TxChangedEvent`                       | Subscribe to transaction changes                                                              |

### RPC Error Codes

```typescript
const RpcErrorCode = {
  // Standard JSON-RPC 2.0 errors
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,

  // CIP-103 provider errors (inherited from EIP-1193)
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901,

  // CIP-103 server errors (inherited from EIP-1474)
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

## Spec alignment (CIP-103)

Sigilry implements [CIP-103: dApp Connection API](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md). CIP-103 §2 states: "The ground truth for the dApp API is maintained in the Splice Wallet repository in a machine-readable form." Per that rule, the canonical CIP-103 OpenRPC spec lives upstream at [`hyperledger-labs/splice-wallet-kernel`](https://github.com/hyperledger-labs/splice-wallet-kernel) and is vendored here at `api-specs/openrpc-dapp-api.json`.

The CIP-103 prose is the conceptual standard; where the prose and the OpenRPC JSON diverge, the JSON wins. For per-method conformance status see [CIP-103 Conformance](https://sigilry.org/concepts/cip-103-conformance/).

### Upstream reference points

- **dApp API spec**: vendored from `core/dapp-api/openrpc.json` in `splice-wallet-kernel`
- **SpliceProvider interface**: compatible with `core/splice-provider/src/SpliceProvider.ts`
- **WalletEvent types**: aligned with `core/types/src/index.ts`

## Maintainers

Originally developed for production use at [Send](https://send.it) and maintained by the Send team. Issues and contributions are accepted on the public mirror at [github.com/sigilry/sigilry](https://github.com/sigilry/sigilry).

## Related

- **Send Extension**: `apps/webext/` - Browser extension using this package
- **Linear Issues**: SEND-78 (scaffold), SEND-77 (implementation)
