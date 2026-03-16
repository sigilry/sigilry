# @sigilry/react

## 1.0.3

### Patch Changes

- 5c42c3e: Patch release for ledger contract hardening and CI reproducibility fixes:
  - check in the Canton OpenAPI snapshot used for code generation
  - harden ledger offset parsing and wire-contract handling
  - ensure codegen drift checks are enforced consistently in CI

- Updated dependencies [5c42c3e]
  - @sigilry/canton-json-api@1.0.1

## 1.0.2

### Patch Changes

- d6fa348: fix: restore networkId on Account type

  The networkId field was prematurely removed from the React Account interface during the user API spec sync. The upstream Wallet schema in openrpc-user-api.json still includes networkId — only the createWallet params had it removed. This restores networkId to the Account type and toAccount() mapping.

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

### Patch Changes

- Updated dependencies [5ddf8ca]
  - @sigilry/dapp@0.2.0
