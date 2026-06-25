# @sigilry/dapp

## 3.3.1

### Patch Changes

- 2994421: WalletConnect transport: validate a restored session is still alive before adopting it.

  A session the wallet deleted while the dApp was away (a missed `session_delete`) was previously adopted on reconnect/reload, which wedged every subsequent relay request and hung `connect()` on "connecting" with no QR (because `restore()` won over `establishSession()`). `restore()` now probes `canton_status` with a short, bounded timeout and, on timeout/failure, tears the dead session down so the caller falls back to a fresh pairing. The timeout is scoped to the liveness probe only — `signMessage`/`prepareSignExecute` still wait on user approval without a timeout.

## 3.3.0

### Minor Changes

- 87bd1d4: Add a dApp-side WalletConnect transport so sigilry dApps can connect to WalletConnect-capable Canton wallets (cross-device / no extension), alongside the existing injected provider.
  - `@sigilry/dapp`: `WalletConnectTransport` — a `BidirectionalTransport` sibling to `WindowTransport` that marshals the typed RPC surface onto the canonical Canton WC namespace (`canton_*`) over `@walletconnect/sign-client`. No dependency on `@canton-network/dapp-sdk`. Ledger reads (`ledgerApi`) go **directly** to the wallet's ledger API via the CIP-103 `network.ledgerApi` base + session token (`${network.ledgerApi}${resource}`), not over the relay — large responses such as the active-contract set exceed the relay's per-message size limit.
  - `@sigilry/react`: `createWalletConnectProvider` + a `walletConnect` option on `CantonReactProvider` — the same hooks drive a WalletConnect session; the pairing URI is delivered via `onUri`.

## 3.2.0

### Minor Changes

- 22182ba: Thread optional `TransportOptions` through announced discovery wallets so dApps can tune transport request timeouts when selecting a provider.

## 3.1.0

### Minor Changes

- a3887d8: Publish the provider discovery subpath and transport notification support for dApps.

## 3.0.0

### Major Changes

- 15fed42: CIP-103 §4.2.2: ship the full push-event surface (`statusChanged` and `connected`, in addition to existing `accountsChanged` and `txChanged`). Schemas are codegen'd from an amended OpenRPC spec in the new `0xsend/canton-network-wallet` fork of `canton-network/wallet` — single source of truth, not a sigilry-local alias.

  **Spec source change**: `packages/dapp/api-specs/openrpc-dapp-api.json` now includes `statusChanged` + `connected` method entries and `StatusChangedEvent` + `ConnectedEvent` component schemas. Each new component schema is `allOf StatusEvent`, so the payload shape stays identical to the `status` RPC result per CIP-103 §4.2.2 (cip-0103.md:323-325, :382). Codegen output: `StatusChangedEventSchema`, `ConnectedEventSchema`, `StatusChangedEvent`, `ConnectedEvent` in `src/generated/schemas.ts`, plus matching entries in the `RpcMethods` interface.

  **Envelope coverage**: `ForwardToInjectedPayloadSchema` discriminated union (`@sigilry/dapp/messages/runtime-schemas`) now covers all four CIP-103 events.

  **BREAKING** — `SpliceProviderBase`:

  - Removed `protected setConnected(boolean)`. The helper emitted bare `"connect"` / `"disconnect"` event names with no payload, which predated CIP-103 §4.2.2 and is non-compliant on three counts: wrong event name (`connect` is the RPC method, not an event), missing `StatusEvent` payload, and `disconnect` is not in the CIP-103 event surface at all (per §4.2.2 line 216, disconnect signals flow through `statusChanged`).
  - Replaced with `protected emitConnected(payload: ConnectedEvent)` and `protected emitStatusChanged(payload: StatusChangedEvent)`. Both update the internal `connected` flag from `payload.connection.isConnected` so `isConnected()` stays in sync with the broadcast state.

  Subscriber audit at branch time found zero external consumers of `provider.on('connect', ...)` / `provider.on('disconnect', ...)`. The only `setConnected` caller was the in-repo `MockProvider` in `examples/demo-app`, which has been migrated in the same change.

  **BREAKING** — `@sigilry/react` `CantonContextValue`:

  - Adds two new required members: `onStatusChanged` and `onConnected`. Downstream consumers that construct object-literal mocks/implementations of `CantonContextValue` must add the new fields (or use a partial mock helper). The fields follow the same registration-hook pattern as the existing `onTxChanged` — `(handler) => () => void` returning an unsubscribe.

  Closes sigilry-private#51. Upstream spec amendment: `0xsend/canton-network-wallet@bb/cip103-events-status-connected`.

## 2.0.0

### Major Changes

- a16e729: Align with CIP-0103: nested StatusEvent, ConnectResult, isConnected method, v2 ledgerApi, SpliceTarget routing, WindowTransport target.

  Migration notes:

  - `@sigilry/react` `ExerciseChoiceRequest` now uses `choice` instead of `choiceName` to match the Canton Ledger API `ExerciseCommand` wire field.

### Patch Changes

- 239e935: Set npm `homepage` to https://sigilry.org. Previously the published packages pointed at `sigilry.github.io` (or, for `@sigilry/splice-dars`, the GitHub README) — re-publish so the npm package pages link to the canonical site. `@sigilry/splice-dars` also gains a `bugs` field for parity with the other packages.
- a16e729: Fix Provider schema `required` list to reference the renamed `providerType` field (was `clientType` after the CIP-0103 rename), so strict JSON Schema validators and downstream codegen treat `providerType` as required rather than optional.

## 2.0.0-next.2

### Patch Changes

- 239e935: Set npm `homepage` to https://sigilry.org. Previously the published packages pointed at `sigilry.github.io` (or, for `@sigilry/splice-dars`, the GitHub README) — re-publish so the npm package pages link to the canonical site. `@sigilry/splice-dars` also gains a `bugs` field for parity with the other packages.

## 2.0.0-next.1

### Major Changes

- 9a4dee7: Align with CIP-0103: nested StatusEvent, ConnectResult, isConnected method, v2 ledgerApi, SpliceTarget routing, WindowTransport target.

  Migration notes:

  - `@sigilry/react` `ExerciseChoiceRequest` now uses `choice` instead of `choiceName` to match the Canton Ledger API `ExerciseCommand` wire field.

### Patch Changes

- 0e05457: Fix Provider schema `required` list to reference the renamed `providerType` field (was `clientType` after the CIP-0103 rename), so strict JSON Schema validators and downstream codegen treat `providerType` as required rather than optional.

## 1.0.1

### Patch Changes

- 7053d26: Sync user API spec with splice-wallet-kernel
  - Update `openrpc-user-api.json` to match splice-wallet-kernel main
  - Add `disabled` and `reason` fields to Wallet schema
  - Add `isWalletSyncNeeded` method to user API
  - Regenerate Zod schemas from updated OpenRPC specs
  - Update React `Account` type with new Wallet fields
  - Add spec alignment note to README

## 1.0.0

### Major Changes

- Sync dApp API to latest Canton Network specification

  Breaking changes:

  - Rename `requestAccounts` to `listAccounts`
  - Rename `darsAvailable` to `getActiveNetwork`
  - Split `prepareReturn` into `prepareExecute` (returns null) and `prepareExecuteAndWait` (returns tx)
  - Rename events: `onAccountsChanged` → `accountsChanged`, `onTxChanged` → `txChanged`

  Reference:

  - CIPs PR #139: https://github.com/global-synchronizer-foundation/cips/pull/139
  - splice-wallet-kernel PR #1115: https://github.com/hyperledger-labs/splice-wallet-kernel/pull/1115

### Minor Changes

- 46aa413: Open-source release with documentation site and modern tooling
  - Add Starlight documentation site with API reference
  - MIT license
  - Switch to public npm registry
  - Replace Biome with oxlint/oxfmt
  - Add knip for unused code detection
  - Use tsgo for typechecking

## 0.2.0

### Minor Changes

- 5ddf8ca: Initial release to GitHub Packages
  - @sigilry/dapp: RPC client/server, transports, provider interface
  - @sigilry/react: React hooks and context for dApp integration
  - @sigilry/cli: TypeScript codegen from DAML DARs
