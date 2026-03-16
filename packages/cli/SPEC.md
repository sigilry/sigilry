# @sigilry/cli Spec

## Overview

`@sigilry/cli` generates TypeScript from DARs and provides project setup helpers for Sigilry consumers.

## Scope

- CLI entrypoint (`sigilry`) with `codegen` workflow support.
- Config loading and resolution (`sigilry.config.*`).
- Reliable invocation of `dpm` and clear preflight errors.

## Key Constraints

- Deterministic generated output from declared DAR inputs.
- Good failure modes when dependencies (`dpm`, DAR paths) are missing.
- Keep CLI behavior test-covered in `packages/cli/__tests__`.

## Non-Goals

- Running ledger infrastructure.
- Acting as a runtime SDK.

## Related Specs

- `SPEC.md`
- `examples/demo-app/SPEC.md`
