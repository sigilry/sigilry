# @sigilry/canton-json-api

Generated TypeScript types and Zod schemas for Canton JSON API v2.

## What this package provides

- TypeScript types generated from the pinned Canton OpenAPI spec
- Zod schemas generated from the same OpenAPI source
- `int64` fields modeled as `bigint` at the contract boundary

## Install

```bash
yarn add @sigilry/canton-json-api
```

## Usage

```ts
import { zGetLedgerEndResponse } from "@sigilry/canton-json-api";

const parsed = zGetLedgerEndResponse.parse({ offset: "42" });
// parsed.offset is bigint
```

## Source of truth and reproducibility

- Pinned Canton artifact version and hash: `scripts/version-config.json`
- Checked-in OpenAPI snapshot: `api-specs/openapi.yaml`
- Generated outputs: `src/generated/types.gen.ts`, `src/generated/zod.gen.ts`, `src/generated/transformers.gen.ts`

CI runs `codegen:check` to ensure generated files match the checked-in OpenAPI snapshot and fail on drift.

## Regenerate

```bash
yarn workspace @sigilry/canton-json-api regen
```

Or run steps individually:

```bash
yarn workspace @sigilry/canton-json-api fetch
yarn workspace @sigilry/canton-json-api codegen
```
