# @sigilry/splice-dars Spec

## Overview

`@sigilry/splice-dars` packages Splice DAR artifacts used for SDK development and examples.

## Scope

- Ship DAR files and typed entrypoints that reference those artifacts.
- Validate package contents before publish (`check:packaging`).
- Keep extraction/maintenance scripts in `packages/splice-dars/scripts`.

## Key Constraints

- Published package must contain required DAR artifacts.
- Entry exports must remain stable for consumers referencing bundled DARs.

## Non-Goals

- Ledger interaction.
- Runtime RPC or React integration.

## Related Specs

- `SPEC.md`
- `examples/demo-app/SPEC.md`
