# @sigilry/react

## 2.0.0

### Minor Changes

- a16e729: Add the `initGraceMs` bootstrap grace-window option to `CantonReactProvider` and the additive `useCanton().onAccountsChanged` subscription so consumers can prefer push-driven connection state updates without breaking existing integrations. Both changes are backwards-compatible: the new prop keeps a safe default and the new subscription method is optional.
- a16e729: Add `useSignMessage`, a react-query mutation hook for the `signMessage` wallet RPC. The hook returns `{ signMessage, signMessageAsync, isPending, isError, error, data, reset }` mirroring `useExerciseChoice` / `useSubmitCommand`. Additive only; no existing public exports change.

### Patch Changes

- a16e729: Align with CIP-0103 amendment: lowercase HTTP methods, object-form request bodies, PascalCase command atoms in `useExerciseChoice`, and split `connect()`/`status()` reads in the React context.
- 239e935: Set npm `homepage` to https://sigilry.org. Previously the published packages pointed at `sigilry.github.io` (or, for `@sigilry/splice-dars`, the GitHub README) — re-publish so the npm package pages link to the canonical site. `@sigilry/splice-dars` also gains a `bugs` field for parity with the other packages.
- a16e729: Fix bootstrap connection-state races so accountsChanged events remain authoritative during in-flight status restore and malformed grace-window account payloads report exactly one error.
- acf18d9: Handle pruned ledger update offsets and oversized update windows in `useLedgerUpdates` and `useContractStream`, with shared request-shaping helpers for Canton JSON API consumers.
- Updated dependencies [a16e729]
- Updated dependencies [239e935]
- Updated dependencies [a16e729]
  - @sigilry/dapp@2.0.0
  - @sigilry/canton-json-api@1.0.2

## 2.0.0-next.3

### Patch Changes

- 239e935: Set npm `homepage` to https://sigilry.org. Previously the published packages pointed at `sigilry.github.io` (or, for `@sigilry/splice-dars`, the GitHub README) — re-publish so the npm package pages link to the canonical site. `@sigilry/splice-dars` also gains a `bugs` field for parity with the other packages.
- acf18d9: Handle pruned ledger update offsets and oversized update windows in `useLedgerUpdates` and `useContractStream`, with shared request-shaping helpers for Canton JSON API consumers.
- Updated dependencies [239e935]
  - @sigilry/dapp@2.0.0-next.2
  - @sigilry/canton-json-api@1.0.2-next.0

## 2.0.0-next.2

### Patch Changes

- a16e729: Fix bootstrap connection-state races so accountsChanged events remain authoritative during in-flight status restore and malformed grace-window account payloads report exactly one error.

## 2.0.0-next.1

### Minor Changes

- 2fb5f43: Add the `initGraceMs` bootstrap grace-window option to `CantonReactProvider` and the additive `useCanton().onAccountsChanged` subscription so consumers can prefer push-driven connection state updates without breaking existing integrations. Both changes are backwards-compatible: the new prop keeps a safe default and the new subscription method is optional.
- 8aefad7: Add `useSignMessage`, a react-query mutation hook for the `signMessage` wallet RPC. The hook returns `{ signMessage, signMessageAsync, isPending, isError, error, data, reset }` mirroring `useExerciseChoice` / `useSubmitCommand`. Additive only; no existing public exports change.

### Patch Changes

- 38d8d0a: Align with CIP-0103 amendment: lowercase HTTP methods, object-form request bodies, PascalCase command atoms in `useExerciseChoice`, and split `connect()`/`status()` reads in the React context.
- Updated dependencies [9a4dee7]
- Updated dependencies [0e05457]
  - @sigilry/dapp@2.0.0-next.1

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
