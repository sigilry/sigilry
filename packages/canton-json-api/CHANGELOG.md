# @sigilry/canton-json-api

## 1.0.2

### Patch Changes

- 239e935: Set npm `homepage` to https://sigilry.org. Previously the published packages pointed at `sigilry.github.io` (or, for `@sigilry/splice-dars`, the GitHub README) — re-publish so the npm package pages link to the canonical site. `@sigilry/splice-dars` also gains a `bugs` field for parity with the other packages.

## 1.0.2-next.0

### Patch Changes

- 239e935: Set npm `homepage` to https://sigilry.org. Previously the published packages pointed at `sigilry.github.io` (or, for `@sigilry/splice-dars`, the GitHub README) — re-publish so the npm package pages link to the canonical site. `@sigilry/splice-dars` also gains a `bugs` field for parity with the other packages.

## 1.0.1

### Patch Changes

- 5c42c3e: Patch release for ledger contract hardening and CI reproducibility fixes:
  - check in the Canton OpenAPI snapshot used for code generation
  - harden ledger offset parsing and wire-contract handling
  - ensure codegen drift checks are enforced consistently in CI
