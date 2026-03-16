# Demo App Spec

## Overview

`examples/demo-app` is the integration reference app for local development.

## Scope

- Exercise `@sigilry/dapp`, `@sigilry/react`, and `@sigilry/cli` together.
- Provide a reproducible local flow for:
  - wallet connection
  - account/session state
  - command submission
  - generated contract types usage

## Key Constraints

- `yarn setup` must bootstrap build + codegen prerequisites.
- Demo app behavior should track package APIs closely and surface integration regressions early.

## Non-Goals

- Production deployment hardening.
- Serving as a complete product UI.

## Related Specs

- `SPEC.md`
- `packages/dapp/SPEC.md`
- `packages/react/SPEC.md`
- `packages/cli/SPEC.md`
