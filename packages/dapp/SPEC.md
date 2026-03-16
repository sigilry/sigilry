# @sigilry/dapp Spec

## Overview

`@sigilry/dapp` defines the transport-agnostic dApp core:

- JSON-RPC client/server primitives
- Message schemas and runtime validation
- Provider abstractions and browser globals
- Transport interfaces and `WindowTransport`

## Scope

- Keep OpenRPC-derived schemas in `src/generated/schemas.ts` as the typed source of truth for dApp-extension RPC.
- Provide typed RPC method contracts (`RpcMethods`) for callers and implementers.
- Keep transports decoupled from chain/business logic.

## Inputs and Sources of Truth

- OpenRPC specs: `packages/dapp/api-specs/openrpc-dapp-api.json`, `packages/dapp/api-specs/openrpc-user-api.json`
- Codegen script: `packages/dapp/scripts/codegen.ts`

## Non-Goals

- React hook abstractions (owned by `@sigilry/react`)
- Ledger endpoint request body typing for Canton JSON API v2 (owned by `@sigilry/canton-json-api`)

## Related Specs

- `SPEC.md`
- `specs/relay-protocol.spec.md`
- `packages/react/SPEC.md`
