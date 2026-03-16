# @sigilry/splice-dars

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
