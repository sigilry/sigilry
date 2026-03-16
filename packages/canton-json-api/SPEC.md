# @sigilry/canton-json-api Spec

## Overview

`@sigilry/canton-json-api` provides generated TypeScript types for Canton JSON API v2.

## Scope

- Pin Canton release + SHA256 in `scripts/version-config.json`.
- Fetch and verify Canton release tarball.
- Extract and check in `api-specs/openapi.yaml` from `openapi/json-ledger-api/openapi.yaml`.
- Generate and publish types in `src/generated/types.gen.ts`.
- Generate and publish Zod schemas in `src/generated/zod.gen.ts`.

## Contract Requirements

- `REQ-CONTRACT-CJA-001`: OpenAPI `int64` fields must be generated as `bigint` in TypeScript outputs.
- `REQ-CONTRACT-CJA-002`: Generated TypeScript and generated Zod schemas must agree on long-integer semantics (`bigint` domain).
- `REQ-CONTRACT-CJA-003`: Generation must remain deterministic from pinned Canton source + hash.
- `REQ-CONTRACT-CJA-004`: OpenAPI `date-time` fields must remain `string` in generated TypeScript request/response shapes (no implicit `Date` coercion at the contract boundary).
- `REQ-CONTRACT-CJA-005`: `api-specs/openapi.yaml` must be version-controlled so codegen is reproducible in CI without fetching Canton artifacts at runtime.

## Key Constraints

- Type generation is deterministic from pinned source version and hash.
- `api-specs/openapi.yaml` is a checked-in snapshot derived from pinned Canton version+hash.
- Generated types are checked in so consumers do not need Canton artifacts at install-time.
- No HTTP client runtime is generated; this package is types-and-schemas only.

## Verification

- `src/contractTypes.assert.ts` must compile in package `typecheck` and enforce:
  - `GetLedgerEndResponse["offset"]` is `bigint`
  - `zGetLedgerEndResponse` output offset is `bigint`
  - `GetUpdatesRequest` and `GetActiveContractsRequest` offset fields stay `bigint` in both TS and Zod output types
  - `GetV2InteractiveSubmissionPreferredPackageVersionData["query"]["vetting_valid_at"]` remains `string | undefined`
- CI must run `codegen:check` and fail if generated contract files drift.

## Non-Goals

- Managing RPC protocol types for extension communication (owned by `@sigilry/dapp`).
- Providing React hooks (owned by `@sigilry/react`).

## Related Specs

- `SPEC.md`
- `packages/react/SPEC.md`
