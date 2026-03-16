# Sigilry Specs Index

This directory contains technical specs and design docs. Use this index to track spec scope and implementation readiness.

## Spec TOC

### Root and Index

- `../SPEC.md` — top-level spec entrypoint and global TOC
- `README.md` — this file

### Repo-Level Specs

- `relay-protocol.spec.md` — Sigilry Relay Protocol (SRP) master spec
- `ci-cd.spec.md` — CI/CD pipeline spec
- `srp-sdk.spec.md`
- `srp-crypto.spec.md`
- `srp-permissions.spec.md`
- `srp-relay-service.spec.md`
- `srp-wallet-ui.spec.md`
- `srp-cli.spec.md`
- `srp-webrtc.spec.md`

### Package/App Sub-Specs

- `../packages/dapp/SPEC.md`
- `../packages/react/SPEC.md`
- `../packages/cli/SPEC.md`
- `../packages/canton-json-api/SPEC.md`
- `../packages/splice-dars/SPEC.md`
- `../examples/demo-app/SPEC.md`
- `../docs/docs-app.spec.md`

## Active Specs

- `relay-protocol.spec.md` — Sigilry Relay Protocol (SRP) master spec
- `ci-cd.spec.md` — CI/CD pipeline spec

## Spec Statuses

| Spec                        | Status      | Notes                            |
| --------------------------- | ----------- | -------------------------------- |
| `relay-protocol.spec.md`    | Draft       | SRP master spec (in progress)    |
| `srp-crypto.spec.md`        | Placeholder | Needs crypto/envelope definition |
| `srp-permissions.spec.md`   | Placeholder | Needs scope/constraints policy   |
| `srp-relay-service.spec.md` | Placeholder | Needs relay service behavior     |
| `srp-sdk.spec.md`           | Placeholder | Needs SDK surface definition     |
| `srp-wallet-ui.spec.md`     | Placeholder | Needs wallet UI flows            |
| `srp-cli.spec.md`           | Placeholder | Needs CLI pairing flow           |
| `srp-webrtc.spec.md`        | Placeholder | Optional phase 2                 |
| `ci-cd.spec.md`             | Draft       | CI/CD pipeline spec              |

## SRP Sub-Specs (Placeholders)

These are required before implementation. Each file contains scope and open questions:

- `srp-sdk.spec.md` — SDK surface: RelayTransport, RelayProvider, connector APIs
- `srp-crypto.spec.md` — encryption, key exchange, envelope format
- `srp-relay-service.spec.md` — relay service behavior and routing
- `srp-wallet-ui.spec.md` — wallet pairing and approval UX
- `srp-cli.spec.md` — CLI pairing flow and localhost UI
- `srp-permissions.spec.md` — scopes, constraints, enforcement policy
- `srp-webrtc.spec.md` — optional WebRTC transport (phase 2)

## Suggested Workflow

1. Flesh out SRP sub-specs in dependency order:
   - `srp-crypto.spec.md`
   - `srp-permissions.spec.md`
   - `srp-relay-service.spec.md`
   - `srp-sdk.spec.md`
   - `srp-wallet-ui.spec.md`
   - `srp-cli.spec.md`
   - `srp-webrtc.spec.md` (optional)
2. Convert each spec into an implementation plan with milestones and owners.
3. Track completion by updating each spec’s Status field.

## Delivery Targets

| Deliverable                         | Status      | Notes                            |
| ----------------------------------- | ----------- | -------------------------------- |
| SRP specs complete                  | Not started | Finish sub-specs above           |
| `@sigilry/dapp` relay MVP           | Not started | RelayTransport + RelayProvider   |
| `@sigilry/react` provider injection | Not started | Support explicit provider        |
| Web extension v1                    | Not started | Ship existing window.canton flow |
