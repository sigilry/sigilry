# @sigilry/react Spec

## Overview

`@sigilry/react` provides React context and hooks for Sigilry wallet + ledger flows.

## Scope

- Expose `CantonReactProvider` and `useCanton` as the canonical integration boundary.
- Provide typed hooks for connection, accounts, sessions, ledger queries, updates, and command submission.
- Reuse shared dApp RPC types from `@sigilry/dapp`.
- Reuse Canton JSON API v2 request/response types from `@sigilry/canton-json-api`.

## Key Constraints

- Public typings must resolve for downstream consumers (runtime deps for types that leak through `.d.ts`).
- Hook payloads should use `updateFormat` / `eventFormat` shapes compatible with Canton JSON API v2.
- `useLedgerUpdates` must include `transactionShape` when using `includeTransactions`.

## Contract Requirements

- `REQ-CONTRACT-REACT-001`: Ledger offset values must be parsed and normalized through canonical helpers before use.
- `REQ-CONTRACT-REACT-002`: `/v2/updates/flats` and `/v2/state/active-contracts` request bodies must serialize long offsets as JSON numbers, not quoted strings.
- `REQ-CONTRACT-REACT-003`: Ledger endpoint responses must be runtime-validated before mapping into hook result types.
- `REQ-CONTRACT-REACT-004`: Ledger boundary code must not use bypass patterns (`as unknown as`, `as any`) for contract fields.
- `REQ-CONTRACT-REACT-005`: Generic ledger requests must treat decoded JSON as `unknown` until caller-provided parsing/validation narrows the type.
- `REQ-CONTRACT-REACT-006`: Wire JSON parsing for ledger offsets must preserve int64 precision and avoid `JSON.parse` precision loss.
- `REQ-CONTRACT-REACT-007`: User-provided offset normalization and wire-offset normalization must remain separate code paths with explicit semantics.

## Verification

- Contract helper tests must cover valid/invalid offset parsing and JSON body serialization.
- Contract helper tests must cover exact large-offset preservation from wire responses.
- Contract safety tests must guard against reintroducing bypass patterns in hardened ledger hooks.
- Package `test`, `typecheck`, and lint checks must pass for contract-related changes.

## Non-Goals

- Defining transport-level protocols (owned by `@sigilry/dapp`)
- Defining canonical ledger endpoint schemas (owned by `@sigilry/canton-json-api`)

## Related Specs

- `SPEC.md`
- `packages/dapp/SPEC.md`
- `packages/canton-json-api/SPEC.md`
