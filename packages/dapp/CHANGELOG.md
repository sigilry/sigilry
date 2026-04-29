# @sigilry/dapp

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
