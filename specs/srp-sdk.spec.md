# SRP SDK Specification (Placeholder)

Status: Placeholder (not defined)

Purpose: Define the SDK surface for SRP, including RelayTransport, RelayProvider, and any connector helpers.

## Scope

- `RelayTransport` interface and config
- `RelayProvider` behavior and event handling
- Optional connector API for auto-selection
- Provider injection for `@sigilry/react`

## Open Questions

- Should connector live in `@sigilry/dapp` or `@sigilry/react`?
- How should pairing UI hooks be exposed to dApps?
- Error mapping for relay vs extension errors

## Dependencies

- `specs/srp-crypto.spec.md`
- `specs/srp-permissions.spec.md`
- `specs/srp-relay-service.spec.md`
