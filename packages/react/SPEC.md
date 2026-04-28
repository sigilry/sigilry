# @sigilry/react Spec

## Overview

`@sigilry/react` provides React context and hooks for Sigilry wallet + ledger flows.

## Scope

- Expose `CantonReactProvider` and `useCanton` as the canonical integration boundary.
- Provide typed hooks for connection, accounts, sessions, ledger queries, updates, and command submission.
- Reuse shared dApp RPC types from `@sigilry/dapp`.
- Reuse Canton JSON API v2 request/response types from `@sigilry/canton-json-api`.

## Key Constraints

- Public typings must resolve for downstream consumers (runtime deps for types that leak through `.d.ts`).
- Hook payloads should use `updateFormat` / `eventFormat` shapes compatible with Canton JSON API v2.
- `useLedgerUpdates` must include `transactionShape` when using `includeTransactions`.

## Contract Requirements

- `REQ-CONTRACT-REACT-001`: Ledger offset values must be parsed and normalized through canonical helpers before use.
- `REQ-CONTRACT-REACT-002`: `/v2/updates/flats` and `/v2/state/active-contracts` request bodies must serialize long offsets as quoted decimal JSON strings so Canton `int64` values round-trip through JavaScript without precision loss.
- `REQ-CONTRACT-REACT-003`: Ledger endpoint responses must be runtime-validated before mapping into hook result types.
- `REQ-CONTRACT-REACT-004`: Ledger boundary code must not use bypass patterns (`as unknown as`, `as any`) for contract fields.
- `REQ-CONTRACT-REACT-005`: Generic ledger requests must treat decoded JSON as `unknown` until caller-provided parsing/validation narrows the type.
- `REQ-CONTRACT-REACT-006`: Wire JSON parsing for ledger offsets must preserve int64 precision and avoid `JSON.parse` precision loss.
- `REQ-CONTRACT-REACT-007`: User-provided offset normalization and wire-offset normalization must remain separate code paths with explicit semantics.

## Cross-cutting Invariants

- **INV-REACT-HOOK-ERR-001**: React hooks in `@sigilry/react` MUST propagate async failures to callers via either (a) react-query mutation/query rejection state (`isError`, `error`), (b) explicit `error` state exposed on the returned object, or (c) a discriminated union state tag (e.g. `connectionStatus: "error"`). A hook MUST NOT silently catch an async failure, log a warning, and proceed with a fallback value that looks like success to the caller.

## Verification

- Contract helper tests must cover valid/invalid offset parsing and JSON body serialization.
- Contract helper tests must cover exact large-offset preservation from wire responses.
- Contract safety tests must guard against reintroducing bypass patterns in hardened ledger hooks.
- Package `test`, `typecheck`, and lint checks must pass for contract-related changes.

## Non-Goals

- Defining transport-level protocols (owned by `@sigilry/dapp`)
- Defining canonical ledger endpoint schemas (owned by `@sigilry/canton-json-api`)

## Connection State Bootstrap

### Problem

`CantonReactProvider` initialization (`src/context.tsx:255-321`) currently bootstraps connection
state by making a single cold `request("status")` call on mount. It reads
`StatusEvent.connection.isConnected` and, if true, proceeds to `listAccounts` and promotes
`connectionState` to `{ status: 'connected' }`.

Two failure modes observed in Send webext CIP-0103 integration testing:

1. A race in the webext controller can cause `status()` to return `connection.isConnected: false`
   immediately after a successful `connect()` (tracked by `REQ-WEBEXT-CSTATE-001..007` on the
   Send webext). Even once that webext race is fixed, CIP-0103 does not guarantee that a provider
   never transiently returns a stale `connection` shape — the protocol has no ordering guarantee
   between `connect()` completion and `status()` observability of that state.
2. Cold-mount right after a page navigation loses any `accountsChanged` event emitted while the
   React tree was unmounted. The provider may already have an active session; the consumer learns
   this only by polling `status()`.

Together these make `connectionState.status === "connected"` unreliable during the first
render after mount — which is exactly when consumer hooks like `useSession`, `useLedgerUpdates`,
`useContractStream`, and `useActiveContracts (enabled: undefined)` gate their polling.

### Domain Model

After `providerReady`, run a **short grace window** before committing to the cold `status()`
result. Any `accountsChanged` event that arrives during the grace window wins; the cold `status()`
call is still issued but its result is discarded if a push event has already promoted state.

```
           providerReady
                 │
                 ▼
       ┌─── Race for state ───┐
       │                      │
   accountsChanged       cold status()
   (push, preferred)     (poll, fallback)
       │                      │
       ▼                      ▼
   Promote to             If grace expired AND
   connected immediately  connection.isConnected === true:
                          promote to connected
                          Else: remain in prior state
```

Grace window default: 150ms (empirically imperceptible; longer than typical LAN RPC). Configurable
via a new optional `CantonReactProvider` prop `initGraceMs`.

### Requirements

| ID                   | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Risk       |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| REQ-REACT-CSTATE-001 | `CantonReactProvider` init prefers the first `accountsChanged` event that arrives within the grace window (`initGraceMs`, default 150ms) after `providerReady`. If present, it promotes `connectionState` to `connected` using the event payload.                                                                                                                                                                                                                                                                                                                                                                                                                                        |            |
| REQ-REACT-CSTATE-002 | If no `accountsChanged` arrives within the grace window, the provider falls back to a cold `request("status")` call, reading `connection.isConnected` and calling `listAccounts` as today.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |            |
| REQ-REACT-CSTATE-003 | If an `accountsChanged` event arrives during an in-flight cold `status()` call, the push-event result wins; the `status()` result is discarded. State never regresses from `connected` back to prior based on a `status()` response that lost the race.                                                                                                                                                                                                                                                                                                                                                                                                                                  |            |
| REQ-REACT-CSTATE-004 | Public hook surface change is additive-only: no existing member of `useCanton`, `useSession`, `useLedgerUpdates`, `useContractStream`, `useActiveContracts`, `useActiveAccount`, `useAccounts`, `useLedgerEnd`, `useSubmitCommand`, `useConnect`, `useExerciseChoice`, or `useCantonProvider` changes its signature or runtime semantics. The only addition permitted is `REQ-REACT-CSTATE-008` below. No removals, no renames.                                                                                                                                                                                                                                                          | Public API |
| REQ-REACT-CSTATE-005 | `CantonReactProvider` accepts a new optional prop `initGraceMs: number` (default 150). Setting `initGraceMs: 0` restores today's cold-status-only behavior.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Public API |
| REQ-REACT-CSTATE-006 | The existing `console.warn` for missing `StatusEvent.connection` remains (legacy-shape detection).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |            |
| REQ-REACT-CSTATE-007 | If neither `accountsChanged` nor `status()` returns a usable signal within the grace window, the provider remains in its initial state (does not force-error). Manual `useConnect().connect()` still works.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |            |
| REQ-REACT-CSTATE-008 | `useCanton()` exposes a new `onAccountsChanged(handler: (accounts: Account[]) => void) => () => void` subscription, semantically identical to the existing `onTxChanged`. Handlers receive the parsed `Account[]` payload produced from the provider's `accountsChanged` event (same array the internal state-writer consumes); an empty array is passed through verbatim so consumers can log "session expired" transitions. The returned function unsubscribes. Handler invocation and internal state mutation both occur on the same event; their relative order is implementation-defined but both must fire for every `accountsChanged` event received while the provider is ready. | Public API |

### Invariants

- **INV-REACT-CSTATE-1**: `connectionState.status === "connected"` becomes true within `initGraceMs + max(accountsChanged_latency, status_request_latency)` when a live session exists in the underlying provider at mount time.
- **INV-REACT-CSTATE-2**: The provider never rolls a `connected` state back to a prior state based solely on an in-flight cold `status()` result that arrived after `accountsChanged` already promoted state.
- **INV-REACT-CSTATE-3**: `onConnectionChange(connectionState)` fires at most once per distinct state transition, regardless of which bootstrap path (event or poll) promoted state.
- **INV-REACT-CSTATE-4**: Every `accountsChanged` event received from the provider while `providerReady === true` causes both (a) every handler registered via `onAccountsChanged` to be invoked with the parsed `Account[]`, and (b) `connectionState` to be updated per REQ-REACT-CSTATE-001..003. Unsubscribed handlers are not invoked.

### Non-Goals

- Introducing a new subscription API in `@sigilry/dapp` (protocol stays on CIP-0103).
- Changing the `ConnectionState` discriminated union shape exposed via `useCanton()`.
- Long-running subscription lifecycle changes to event handlers (existing `accountsChanged`/`txChanged` handlers keep their lifecycle).
- Replacing the cold `status()` fallback; it remains as the steady-state bootstrap for providers that do not push on wake.

### Acceptance Criteria

- [ ] `dapp-hooks.spec.ts` (canton-monorepo): `useLedgerUpdates > shows real-time transaction updates after Ping submission` passes.
- [ ] `dapp-hooks.spec.ts`: `useLedgerUpdates > displays offset and connection status` passes.
- [ ] `dapp-hooks.spec.ts`: `useContractStream > stream offset updates after ledger activity` passes.
- [ ] `dapp-hooks.spec.ts`: `useSession > displays session status and JWT claims after connect` passes.
- [ ] `dapp-hooks.spec.ts`: `useSession > refresh button is available for session refresh` passes.
- [ ] `dapp-hooks.spec.ts`: `useActiveContracts (TransferPreapproval) > queries for TransferPreapproval contracts after connect` passes.
- [x] Existing tests pass unchanged (`packages/react/__tests__/useLedgerUpdates.test.ts`, `packages/react/__tests__/useLedgerUpdates.integration.test.tsx`).
- [x] New unit test: grace-window race where `accountsChanged` fires at T+50ms — `connectionState.status === "connected"` at T+50ms, cold `status()` result discarded.
- [x] New unit test: grace-window fallback where no event fires and cold `status()` returns `isConnected: true` at T+250ms — `connectionState.status === "connected"` at T+250ms.
- [x] New unit test: `initGraceMs: 0` restores today's behavior exactly (cold status, no event debounce).
- [x] New unit test: `useCanton().onAccountsChanged(handler)` — handler fires with parsed `Account[]` when provider emits `accountsChanged`; unsubscribe function removes the handler; handler still fires for the empty-array (session-expired) payload.
- [x] New unit test: multiple handlers registered via `onAccountsChanged` all fire for a single provider event; internal state mutation still occurs regardless of handler count.
- [x] Changeset added under `.changeset/` documenting a minor version bump (new optional prop + new additive subscription method, non-breaking).

### Risk Tags

- **Public API**: adds one optional prop with a backwards-compatible default. Minor version bump.
- **Timing**: grace-window tuning may need adjustment for very slow environments (e.g., CI with high RPC latency). Default chosen for LAN / localhost profile; reviewable after e2e.

## SignMessage

### Problem

The underlying `signMessage` JSON-RPC method has always been part of the provider surface
(`@sigilry/dapp/schemas:SignMessageRequestSchema`), but `@sigilry/react` has no typed hook over it.
Consumers wanting to request a signature must drop to
`useCantonProvider().provider.request(...)` with its untyped escape hatch.

### Requirements

| ID                 | Requirement                                                                                                                                                   | Risk       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| REQ-REACT-SIGN-001 | `useSignMessage()` exposes `signMessage`, `signMessageAsync`, `isPending`, `isError`, `error` (as `ParsedError \| null`), `data`, `reset`.                    | Public API |
| REQ-REACT-SIGN-002 | The hook routes through `useCanton().request("signMessage", params)` with no schema re-validation on the React side.                                          |            |
| REQ-REACT-SIGN-003 | On failure the hook surfaces a `ParsedError` via the `error` field; the caller may also await `signMessageAsync` and catch a rejected promise.                |            |
| REQ-REACT-SIGN-004 | Calling `signMessage` / `signMessageAsync` before the provider is ready rejects with the existing provider-not-ready error; the hook does not silently no-op. |            |
| REQ-REACT-SIGN-005 | `useSignMessage` is additive; no other member of the `@sigilry/react` public surface changes its signature or runtime behavior to accommodate it.             | Public API |

### Invariants

- **INV-REACT-SIGN-1**: `signMessageAsync(...)` resolves iff the RPC returns a `SignMessageResult`; it never returns undefined on success.
- **INV-REACT-SIGN-2**: The hook delegates to react-query `useMutation`; repeated calls produce fresh promises, and `data` reflects only the most recent successful result.

### Non-Goals

- Client-side signature verification (ECDSA/DER parsing). That belongs in consumer code (or the demo-app utility module).
- Exposing the public key of the signing account; consumers can get it from `useActiveAccount()`.

### Acceptance Criteria

- [ ] `packages/react/src/hooks/useSignMessage.ts` exports the hook with the surface described above.
- [ ] `packages/react/__tests__/useSignMessage.test.ts` covers success, error, and provider-not-ready paths.
- [ ] `@sigilry/react` SPEC lists `REQ-REACT-SIGN-001..005`.
- [ ] Changeset under `.changeset/use-sign-message.md` records the minor bump.

## Related Specs

- `SPEC.md`
- `packages/dapp/SPEC.md`
- `packages/canton-json-api/SPEC.md`
- Downstream consumer: Send webext (`canton-monorepo/apps/webext/SPEC.md`, section "Connection State (Single-Writer)", `REQ-WEBEXT-CSTATE-*`).
- Cross-repo coordination (external): `_work/2744-announce-provider-cip103/SPEC-connection-state.md`.
