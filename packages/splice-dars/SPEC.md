# @sigilry/splice-dars Spec

## Overview

`@sigilry/splice-dars` vendors Splice DAR artifacts and provides typed path exports for consumers.

## Scope

- Ship DAR files and typed entrypoints that resolve to those artifacts at runtime.
- Build compiled JS + `.d.ts` declarations via zshy (same as other @sigilry packages).
- Validate package contents before publish (`prepack` + `check:packaging`).
- Export `SPLICE_VERSION` so consumers can check which Splice release the DARs came from.

## Exports

- `spliceDars` — named object mapping DAR keys to resolved file paths (readonly).
- `allSpliceDars` — all DAR paths as a readonly array.
- `SPLICE_VERSION` — string literal of the upstream Splice release version.

## Key Constraints

- Published package must contain required DAR artifacts in `dars/`.
- DAR extraction uses SHA256 verification against the upstream release tarball.
- Entry exports must remain stable for consumers referencing bundled DARs.
- Package follows changeset-managed semver; Splice version is metadata, not the package version.

## Non-Goals

- Ledger interaction.
- Runtime RPC or React integration.
- DAR compilation or modification.

## Related Specs

- `SPEC.md`
- `examples/demo-app/SPEC.md`
