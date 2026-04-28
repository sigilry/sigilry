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

## Examples Gallery

In addition to the end-to-end Todo integration (`<DAppPane />`), the demo app ships three polished examples that mirror the browser-console gist patterns external teams currently reference. Each example is a React component that uses `@sigilry/react` hooks exclusively, with `useLedgerApi` reserved for cases where there is no dedicated hook.

| Example          | Phase   | Hook stack                                                                                  | Notes                                                                                             |
| ---------------- | ------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Active Contracts | Phase 3 | `useConnect`, `useActiveAccount`, `useActiveContracts()`                                    | Wildcard query uses the current hook surface by omitting `templateFilter`; groups by template id. |
| Sign Message     | Phase 4 | `useSignMessage`, `useActiveAccount`, signature verify utility in `src/lib/ecdsa-verify.ts` | Adds client-side verification for the local Ed25519 simulator and ECDSA P-256 wallets.            |
| USDCx Transfer   | Phase 5 | `useActiveAccount`, `useLedgerApi`, `useSubmitCommand`                                      | Interface-filter gap in `useActiveContracts` requires the `useLedgerApi` escape hatch.            |

## Related Specs

- `SPEC.md`
- `packages/dapp/SPEC.md`
- `packages/react/SPEC.md`
- `packages/cli/SPEC.md`
