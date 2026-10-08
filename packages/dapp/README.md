# @sigilry/dapp

Core package for [CIP-103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)-compliant dApp ↔ wallet extension communication on Canton Network. Provides the typed `SpliceProvider` interface, JSON-RPC client/server, transports, and Zod schemas generated from the CIP-103 OpenRPC specification.

The CIP-103 OpenRPC machine-readable spec is maintained upstream in [`hyperledger-labs/splice-wallet-kernel`](https://github.com/hyperledger-labs/splice-wallet-kernel) and vendored into `packages/dapp/api-specs/openrpc-dapp-api.json`; per CIP-103 §2 the OpenRPC JSON is the ground truth where the prose and the schema diverge.

## Installation

```bash
yarn add @sigilry/dapp@^3
```

The stable Canton Network / CIP-0103 SDK line is 3.x on `latest`. Use `@sigilry/react@^3` for React integration. The `next` tag is frozen on an older prerelease; see the [migration guides](https://sigilry.org/migrations/) when upgrading.

Partner guides: [Send Connect testnet](https://sigilry.org/guides/send-connect-testnet/), [verify signMessage](https://sigilry.org/guides/verify-sign-message/), and [read holdings](https://sigilry.org/guides/read-holdings/).

## Overview

This package provides the building blocks for dApp ↔ wallet extension communication:

- **SpliceProvider interface**: CIP-103 dApp API surface (`request`/`on`/`removeListener` — the EIP-1193 object shape that CIP-103 adopts), plus the `SpliceProviderBase` class for implementers
- **Provider discovery**: EIP-6963-style multi-wallet discovery via `@sigilry/dapp/discovery`
- **Transports**: `WindowTransport` (`postMessage`) and `WalletConnectTransport`; implement `RpcTransport` for other channels
- **RPC utilities**: client/server factories with CIP-103-aligned error codes (`RpcErrorCode`)
- **Zod schemas**: runtime validation generated from the CIP-103 OpenRPC spec (`@sigilry/dapp/schemas`)

## Usage

Call the injected provider. `window.canton` is typed only after importing `@sigilry/dapp/browser-globals`, and it is optional because no wallet may be installed:

```typescript
import "@sigilry/dapp/browser-globals";

if (window.canton) {
  const status = await window.canton.request({ method: "status" });
  console.log("Connected:", status.connection.isConnected);
}
```

Discover every announced wallet instead of assuming a single `window.canton`:

```typescript
import { createDiscoveryStore } from "@sigilry/dapp/discovery";

const store = createDiscoveryStore();
const unsubscribe = store.subscribe(
  (wallets) => {
    const provider = wallets[0]?.getProvider();
    provider?.on("statusChanged", (status) => console.log(status));
  },
  { emitImmediately: true },
);
```

The [package guide](https://sigilry.org/packages/dapp/) covers the typed client, the extension-side RPC server, discovery, push events, and generated schemas. The [API reference](https://sigilry.org/api-reference/readme/) lists every export.

## Entry points

| Import path                              | Contents                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| `@sigilry/dapp`                          | Re-exports `messages`, `provider`, `rpc`, `transport`; `CANTON_DAPP_API_VERSION` |
| `@sigilry/dapp/browser-globals`          | Side-effect import that types `window.canton?: SpliceProvider`                   |
| `@sigilry/dapp/discovery`                | `requestProviders`, `announceProvider`, `createDiscoveryStore`, `createProvider` |
| `@sigilry/dapp/messages`                 | `WalletEvent`, message types, `isSpliceMessage`, JSON-RPC helpers                |
| `@sigilry/dapp/messages/runtime-schemas` | Extension-internal runtime message schemas (background ↔ injected provider)      |
| `@sigilry/dapp/provider`                 | `SpliceProvider`, `SpliceProviderBase`, typed request types                      |
| `@sigilry/dapp/rpc`                      | `createCantonClient`, `createCantonServer`, `RpcErrorCode`, `RpcClientError`     |
| `@sigilry/dapp/schemas`                  | Generated Zod schemas and types                                                  |
| `@sigilry/dapp/transport`                | `WindowTransport`, `WalletConnectTransport`, transport types                     |

### RPC Methods

| Method                  | Params                       | Result                                 | Description                                                                                                                |
| ----------------------- | ---------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `status`                | none                         | `StatusEvent`                          | Get connection status                                                                                                      |
| `connect`               | none                         | `ConnectResult`                        | Connect and report whether the wallet authorized access                                                                    |
| `disconnect`            | none                         | `null`                                 | Disconnect session                                                                                                         |
| `isConnected`           | none                         | `ConnectResult`                        | Check whether the wallet is connected                                                                                      |
| `getActiveNetwork`      | none                         | `Network`                              | Get active network                                                                                                         |
| `listAccounts`          | none                         | `Wallet[]`                             | Get authorized accounts                                                                                                    |
| `getPrimaryAccount`     | none                         | `Wallet`                               | Get the primary account                                                                                                    |
| `prepareExecute`        | `JsPrepareSubmissionRequest` | `null`                                 | Prepare, sign, and execute transaction                                                                                     |
| `prepareExecuteAndWait` | `JsPrepareSubmissionRequest` | `{ tx: TxChangedExecutedEvent }`       | Execute transaction and wait for completion                                                                                |
| `signMessage`           | `{ message: string }`        | `SignMessageResult`                    | Sign an arbitrary message; `signature` plus optional `signedBy`, `publicKey`, `signingAlgorithmSpec`, `format`, `encoding` |
| `ledgerApi`             | `LedgerApiRequest`           | `Record<string, unknown> \| unknown[]` | Returns the Canton Ledger API JSON response as an object or array, depending on the endpoint.                              |

Push events are delivered through `provider.on()` rather than request/response: `accountsChanged`, `txChanged`, `statusChanged` (CIP-103 §4.2.2; disconnects route through here), and `connected` (login-flow completion; identical payload to `statusChanged`).

### WindowTransport Options

```typescript
interface TransportOptions {
  timeout?: number; // Request timeout in ms (default: 30000)
  targetOrigin?: string; // postMessage target origin (default: '*')
  target?: string; // Routing key for a specific wallet extension (default: undefined)
}
```

## Generated Schemas

Zod schemas are generated from the vendored OpenRPC specification:

```typescript
import { StatusEventSchema, type StatusEvent } from "@sigilry/dapp/schemas";

declare const data: unknown;
const status: StatusEvent = StatusEventSchema.parse(data);
```

Regenerate schemas after spec changes:

```bash
yarn workspace @sigilry/dapp codegen
```

## Project Structure

```
packages/dapp/
├── api-specs/
│   ├── openrpc-dapp-api.json    # CIP-103 dApp API spec (vendored)
│   └── openrpc-user-api.json    # User API spec (referenced)
├── scripts/
│   └── codegen.ts               # Schema generation script
├── src/
│   ├── browser-globals.ts       # window.canton global typing (opt-in)
│   ├── discovery/               # Provider discovery store, announce/request, createProvider
│   ├── generated/
│   │   └── schemas.ts           # Generated Zod schemas
│   ├── messages/
│   │   ├── events.ts            # WalletEvent enum
│   │   ├── schemas.ts           # Message type validators
│   │   ├── runtime-schemas.ts   # Extension runtime message schemas
│   │   └── index.ts
│   ├── provider/
│   │   ├── interface.ts         # SpliceProvider interface
│   │   ├── base.ts              # SpliceProviderBase class
│   │   ├── typed-request.ts     # Typed request/result helpers
│   │   └── index.ts
│   ├── rpc/
│   │   ├── client.ts            # RPC client factory
│   │   ├── server.ts            # RPC server factory
│   │   ├── errors.ts            # Error codes and helpers
│   │   └── index.ts
│   ├── transport/
│   │   ├── types.ts             # Transport interfaces
│   │   ├── window.ts            # WindowTransport class
│   │   ├── walletconnect.ts     # WalletConnectTransport class
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
