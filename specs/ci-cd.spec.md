# CI/CD Specification

## Overview

GitHub Actions CI/CD pipeline for the sigilry monorepo. Implements continuous integration with deferred npm publishing.

## Project Context

| Aspect              | Value      |
| ------------------- | ---------- |
| Package manager     | yarn 4.9.1 |
| Build orchestration | turborepo  |
| Testing             | bun:test   |
| Linting             | oxlint     |
| Formatting          | oxfmt      |
| Versioning          | changesets |
| Dev shell           | Nix        |

**Packages**:

- `@sigilry/cli` - CLI for TypeScript codegen from DAML
- `@sigilry/dapp` - Core dApp ↔ extension RPC types/transports
- `@sigilry/react` - React hooks and context
- `@sigilry/canton-json-api` - Generated Canton JSON API v2 types + schemas
- `@sigilry/splice-dars` - Private, DAR files for testing

## Workflows

### 1. CI Workflow

**File**: `.github/workflows/ci.yml`

**Triggers**:

- Push to `main`
- Pull requests targeting `main`

**Environment**:

- Runner: `ubuntu-latest`
- Toolchain bootstrap: Nix (`nix develop`)
- Package manager: Corepack Yarn 4.9.1
- Runtime tools: Node + Bun from Nix devShell

**Jobs**:

- `CI (internal PR)`: runs on PRs from same repository.
- `CI (main trusted)`: runs on pushes to `main` and manual dispatch.

Both jobs run equivalent checks in Nix devShell:

1. `nix flake check`
2. `corepack yarn install --immutable`
3. `corepack yarn workspace @sigilry/canton-json-api codegen:check`
4. `corepack yarn typecheck`
5. `corepack yarn lint`
6. `corepack yarn format:check`
7. `corepack yarn knip`
8. `corepack yarn build`
9. `corepack yarn test`

**Contract Drift Guard**:

- `@sigilry/canton-json-api` codegen is pinned and checked in.
- `packages/canton-json-api/api-specs/openapi.yaml` must remain version-controlled so `codegen:check` is reproducible in CI.

**Caching Strategy**:

- Cache Yarn artifacts (`.yarn/cache`, `.yarn/unplugged`, `.yarn/install-state.gz`)
- Cache `node_modules` and `.turbo`
- Cache `~/.cache/node/corepack`
- Optionally use Magic Nix Cache in trusted main workflow

**splice-dars Handling**:

- DAR files are pre-extracted and committed to repository
- No Docker required in CI
- If DARs need updating, run `yarn workspace @sigilry/splice-dars extract` locally with Docker

### 2. Release Workflow (Future)

**File**: `.github/workflows/release.yml`

**Status**: Documented for future implementation. All packages currently private.

**Trigger**: Merge of "Version Packages" PR created by changesets bot

**Mechanism**:

1. Changesets bot detects changeset files on push to main
2. Bot creates/updates "Version Packages" PR with version bumps
3. Maintainer merges PR when ready to release
4. Release workflow publishes to npm

**Jobs**:

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write # Create git tags
      id-token: write # npm provenance
    steps:
      - Checkout
      - Setup Node 22
      - Setup Bun
      - Enable Corepack
      - Install dependencies
      - Build
      - Publish with changesets (--provenance)
```

**Partial Failure Recovery**:

- Changesets handles idempotency
- Safe to re-run entire release workflow
- Already-published packages are skipped automatically

**Packages to Publish** (when enabled):

- `@sigilry/cli`
- `@sigilry/dapp`
- `@sigilry/react`

**Excluded**:

- `@sigilry/splice-dars` (private: true)

### 3. Pre-release Workflow (Future)

**File**: `.github/workflows/prerelease.yml`

**Trigger**: Manual workflow dispatch

**Purpose**: Publish canary/alpha versions for testing before stable release

**Parameters**:

- `tag`: Pre-release tag (e.g., `alpha`, `beta`, `canary`)

### 4. Dependabot

**File**: `.github/dependabot.yml`

**Configuration**:

- Security updates only
- Ecosystem: npm
- Target: `main` branch

## Security

### Secrets

| Secret      | Scope      | Purpose                    |
| ----------- | ---------- | -------------------------- |
| `NPM_TOKEN` | Repository | npm publish authentication |

**Setup**: Generate granular access token on npmjs.com with publish scope for `@sigilry/*`

### Provenance

npm packages published with `--provenance` flag:

- Cryptographic attestation linking package to GitHub Actions build
- Displays verification badge on npmjs.com
- Requires `id-token: write` permission

### Branch Protection (main)

- Require status checks to pass before merge
- Required checks: current CI workflow jobs for protected branch policy
- No approval required
- Allow force push: No
- Allow deletion: No

## Success Criteria

### CI

- [ ] All checks pass on clean main branch
- [ ] PR checks block merge on failure
- [ ] Cache provides meaningful speedup on subsequent runs
- [ ] Workflow completes in < 5 minutes

### Release (when implemented)

- [ ] Changesets bot creates Version Packages PR
- [ ] Merge triggers publish to npm
- [ ] Published packages have provenance badge
- [ ] Git tags created for releases

## Implementation Order

1. **Phase 1 (Now)**: CI workflow + Dependabot
2. **Phase 2 (When npm org ready)**: Release workflow
3. **Phase 3 (Optional)**: Pre-release workflow

## Decisions Log

| Decision                        | Rationale                                               | Date       |
| ------------------------------- | ------------------------------------------------------- | ---------- |
| Node 22 only                    | Current LTS, matches engines >= 18.19.0, simpler matrix | 2026-01-02 |
| Ubuntu only                     | Library code is OS-agnostic, faster/cheaper             | 2026-01-02 |
| Local turbo cache               | Avoids Vercel account dependency                        | 2026-01-02 |
| Changesets bot PR               | Standard flow, maintainer controls release timing       | 2026-01-02 |
| Provenance enabled              | Adds trust, minimal overhead                            | 2026-01-02 |
| CI pass only (no approval)      | Small team, fast iteration                              | 2026-01-02 |
| Cache extracted DARs            | Avoids Docker in CI, DARs rarely change                 | 2026-01-02 |
| Repository secret for NPM_TOKEN | Simple, single repo                                     | 2026-01-02 |
| Dependabot security only        | Minimal noise, manual version updates                   | 2026-01-02 |
| Defer publishing                | npm org setup pending                                   | 2026-01-02 |
