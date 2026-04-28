# @sigilry/splice-dars

## 0.4.1-next.0

### Patch Changes

- 239e935: Set npm `homepage` to https://sigilry.org. Previously the published packages pointed at `sigilry.github.io` (or, for `@sigilry/splice-dars`, the GitHub README) — re-publish so the npm package pages link to the canonical site. `@sigilry/splice-dars` also gains a `bugs` field for parity with the other packages.

## 0.4.0

### Minor Changes

- Update to Splice v0.5.14 DARs and add zshy build step for proper consumer types
  - Update vendored DARs to Splice v0.5.14 (12 DAR files including new token standard APIs)
  - Add zshy build producing compiled JS + `.d.ts` declarations
  - Ship conditional exports (`types` + `default`) matching other @sigilry packages
  - Revert to changeset-managed semver (SPLICE_VERSION export tracks the Splice release)

## 0.3.1

### Patch Changes

- Ensure package publish/pack includes required DAR files by extracting them during `prepack`.
- Add `check:packaging` validation that runs `npm pack --json` and asserts tarball contents include:
  - `dars/splice-amulet-current.dar`
  - `dars/splice-wallet-payments-current.dar`

## 0.3.0

### Minor Changes

- 46aa413: Open-source release with documentation site and modern tooling
  - Add Starlight documentation site with API reference
  - MIT license
  - Switch to public npm registry
  - Replace Biome with oxlint/oxfmt
  - Add knip for unused code detection
  - Use tsgo for typechecking
