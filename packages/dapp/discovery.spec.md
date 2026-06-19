# Provider Discovery & Push-Event Channel — `@sigilry/dapp` Spec

Supporting spec for [`./SPEC.md`](./SPEC.md). Covers the two capabilities `@sigilry/dapp`
is missing to be a complete, announce-first Canton dApp toolkit: **provider discovery**
(the `canton:announceProvider` tier) and the **push-event channel** (wallet→dApp event
delivery over the `postMessage` transport).

The two halves sit at different standards levels, and this spec keeps them distinct:

- **Push-event channel — CIP-103 event _semantics_, sigilry _wire_.** The events are CIP-103,
  but two distinctions matter (F-CIP103-001/002):
  - The sync dApp API §4.2.2 event set is exactly three: `accountsChanged`, `statusChanged`,
    `txChanged` (`cip-0103.md:183-187`). `connected` is an _additional_ login-flow event
    (`cip-0103.md:368-372`), present in the generated OpenRPC artifact (`generated/schemas.ts`)
    but **not** one of the sync §4.2.2 three; this spec does not require a sync provider to emit
    or "§4.2.2-support" `connected`.
  - CIP-103 defines event _semantics_ and is transport-agnostic; it does **not** define the
    concrete `postMessage` notification envelope (`cip-0103.md:431-432`; the superseded proposal
    confirms the sync spec defines no wire, `cip103-sync-push-events-proposal.md:13-15`). The
    id-less `SPLICE_WALLET_REQUEST` wire (REQ-EVT-002) is therefore a **cross-implementation
    interop convention** (aligned to merged `#1814`), not CIP-103 itself until amended.

  `@sigilry/dapp` already declares all of these event schemas; what is missing is the transport
  leg that delivers them.

- **Provider discovery — pre-standard convention, NOT CIP-103.** CIP-103 explicitly puts the
  multi-provider announcement mechanism **out of scope**: "the mechanism for such announcements
  is out of scope for this CIP … We expect the mechanism for dealing with multiple providers to
  be specified in a future CIP" (`cip-0103.md:140-142`). `canton:announceProvider` is therefore
  a Send-Connect/sigilry convention modeled on EIP-6963/`mipd`, filling the gap CIP-103 defers.
  This spec does not claim CIP-103 conformance for the discovery tier; it aims to be a faithful
  EIP-6963 analog that a future Canton discovery CIP can ratify or supersede.

**Status:** Implemented — shipped in `@sigilry/dapp@3.1.0`. Acceptance validated by
`packages/dapp/__tests__/discovery-{store,utils,provider}.test.ts` (part of the 104-test dapp suite)
and the canton-monorepo discovery e2e (`apps/playwright/tests/extension/dapp-discovery.spec.ts`).
Authored against the wevm reference stack at `~/0xbigboss/wevm` (`mipd`, `viem`, `wagmi`).

## Problem

`@sigilry/dapp` today implements only the request/response half of CIP-103 and has no
discovery tier:

1. **No discovery.** A dApp cannot enumerate available Canton wallets. The only way to
   reach a wallet is to read the injected `window.canton` directly
   (`@sigilry/react` `context.tsx:203` — `return (window as CantonWindow).canton ?? null`).
   That is single-wallet, injection-only, and contradicts the announce-first directive
   ("never `window.canton` reliance; gate event paths on the announced target").
2. **No push-event channel.** `WindowTransport` (`src/transport/window.ts`) is
   request/response only: `submit()` installs a per-request, id-correlated, self-removing
   listener (`:63-96`), and `submitResponse()` (`:115-124`) sends responses. There is **no
   always-on inbound listener**, so a provider built from sigilry's transport can never
   receive a wallet-pushed `txChanged`/`accountsChanged`/`statusChanged`. The event names
   exist in sigilry's surface (`rpc/server.ts` lists them in `paramsSchemaByMethod`; the CIP-103
   `SpliceProvider` interface declares `on`/`emit`) but nothing delivers them. Consumers fake
   it: the Send Connect webext hand-rolls a `SPLICE_WALLET_EVENT` `window.addEventListener`
   in its injected provider (`apps/webext/lib/provider.ts:33-47`), which only works because
   the webext also injects `window.canton`.

The two gaps are coupled: announce-first discovery means a dApp constructs its own provider
from the announced routing key, and that constructed provider must carry the event channel
or it is request/response-only (the canton-network/wallet#1815 defect, reproduced inside
sigilry).

## Solution

Add the missing **mipd tier** to `@sigilry/dapp` and the **notification leg** to its
transport, modeled on the wevm stack (same authors as viem/wagmi):

| wevm (`~/0xbigboss/wevm`)                                      | `@sigilry/dapp`                                          | Role                                           |
| -------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------- |
| `mipd` — `createStore`, `requestProviders`, `announceProvider` | **NEW** `src/discovery/`                                 | EIP-6963 / `canton:announceProvider` discovery |
| `viem` — typed RPC client, transport, EIP-1193 provider        | existing `provider/`, `transport/`, `rpc/`, `generated/` | low-level primitives                           |
| `wagmi` — connectors, hooks, `multiInjectedProviderDiscovery`  | `@sigilry/react` (separate spec)                         | React framework tier                           |

### The deliberate divergences from EIP-6963

Two, both load-bearing.

**1 — routing key, not a provider object.** EIP-6963's announce detail carries the **provider
object**: `EIP6963ProviderDetail = { info, provider }` (`mipd/src/types.ts:6-12`). Send Connect's
`canton:announceProvider` carries a **routing key** instead. The wallet announces metadata + a
`target` string only; **no provider implementation crosses the page boundary**. `@sigilry/dapp`
(open) constructs the provider _from_ the target via `createProvider(detail)` (REQ-DISC-006).
mipd's `detail.provider` field becomes sigilry's `detail.target` field + the `createProvider`
factory. This indirection is the open-SDK / closed-wallet boundary: the closed wallet ships
~30 lines (`announceProvider`), the open SDK owns the client.

**2 — flat wire, nested consumer type.** EIP-6963 nests identity under `detail.info`
(`{ info: { uuid, rdns, name, icon }, provider }`) and consumers read `detail.info` directly.
sigilry keeps the **wire flat** — `{ id, name, icon, target, rdns, uuid }` — an _additive
superset_ of Send Connect's already-shipped `{ id, name, icon, target }`
(`apps/webext/lib/content-announcement.ts:16-23`): `rdns` + `uuid` are added, nothing is removed.
mipd can nest because it has no prior shape to stay compatible with; sigilry does — a published
Send Connect webext already emits the flat shape, and any reader must tolerate it. Making the
_new_ shape also flat means the SDK reads **one** wire shape forever (additive evolution), never a
legacy-vs-new fork, so the announce shape has **no breaking transition**. mipd parity is preserved
where it matters — the **consumer** type: `createDiscoveryStore` normalizes the flat wire detail
into a nested `DiscoveredWallet { info: SpliceProviderInfo, … }`, so dApp builders coming from
EIP-6963/mipd still read a familiar `info` object. Wire and consumer are intentionally different
types (`SpliceAnnounceDetail` vs `SpliceProviderInfo`); only the raw `postMessage`/`CustomEvent`
detail is flat.

## Domain model

```ts
// canton:announceProvider WIRE detail — FLAT, an additive superset of today's
// { id, name, icon, target }. Adds rdns + uuid; removes nothing, so an old reader keeps
// working and a new reader picks up the two new fields. NOT a provider object. This is the
// deliberate flat-wire divergence from mipd's nested detail.info — see above.
interface SpliceAnnounceDetail {
  id: string; // DEPRECATED alias of `target` (== runtimeId today); kept for back-compat
  name: string;
  icon: `data:image/${string}`; // RFC-2397 data URI (typed, per mipd)
  target: string; // the WindowTransport routing key (canonical)
  rdns: string; // stable reverse-DNS wallet id (NEW; absent on pre-discovery webexts)
  uuid: string; // per-announce id (NEW; absent on pre-discovery webexts)
}

// Normalized CONSUMER identity — CIP-103 analog of EIP6963ProviderInfo (mipd/src/types.ts:17-22).
// The store builds this from the flat detail's top-level fields; it is DiscoveredWallet.info,
// NOT the wire shape.
interface SpliceProviderInfo {
  uuid: string; // per-announce id; dedupe key for the store
  rdns: string; // stable reverse-DNS wallet id, e.g. "it.send.connect"
  name: string;
  icon: `data:image/${string}`;
}

// Normalized discovery result. Unifies announced + injected behind one lazy accessor,
// the way wagmi unifies EIP-6963 + legacy window.ethereum connectors. The store NORMALIZES
// the flat wire detail into this nested shape (info bundles identity).
interface DiscoveredWallet {
  info: SpliceProviderInfo; // normalized from the flat detail's { uuid, rdns, name, icon }
  getProvider(opts?: TransportOptions): SpliceProvider; // announced → createProvider(detail, opts); injected → window.canton
}
```

The push envelope reuses the existing `SPLICE_WALLET_REQUEST` type with **`id` absent**
(a JSON-RPC 2.0 notification) — see REQ-EVT-002 and the supersession note below.

## Requirements — Discovery (`REQ-DISC-*`)

- **REQ-DISC-001** — `announceProvider(detail: SpliceAnnounceDetail): () => void` (wallet
  side). Dispatches a frozen `canton:announceProvider` `CustomEvent` immediately, and
  re-dispatches on every `canton:requestProvider`. Returns an unsubscribe that removes the
  request listener. Mirrors `mipd/src/utils.ts:19-32` (incl. `Object.freeze(detail)`).
- **REQ-DISC-002** — the announce detail is the **flat** `{ id, name, icon, target, rdns, uuid }`
  (`SpliceAnnounceDetail`), an additive superset of Send Connect's shipped `{ id, name, icon, target }`
  — `rdns` + `uuid` added, nothing removed. It MUST NOT carry a provider object. `target` is the
  routing key the dApp passes to `WindowTransport`; `id` is a deprecated alias of `target` (equal
  to `target` today) retained for back-compat. The store normalizes this flat detail into a nested
  `DiscoveredWallet.info` (the flat-wire/nested-consumer divergence above).
- **REQ-DISC-003** — `SpliceProviderInfo` (`{ uuid, rdns, name, icon }`) is the **normalized
  consumer** identity exposed as `DiscoveredWallet.info`, NOT the wire shape — the store builds it
  from the flat detail's top-level `uuid`/`rdns`/`name`/`icon`. `uuid` is unique per announce (store
  dedupe key); `rdns` is a stable reverse-DNS wallet identity (dedupe / "remember last wallet" key);
  `icon` is typed `` `data:image/${string}` ``. Mirrors `mipd/src/types.ts:17-22`. `SpliceProviderInfo`
  is **total** — both `uuid` and `rdns` are always present; the store never produces a partial info.
  **Legacy details** (a pre-discovery webext emitting `{ id, name, icon, target }` with no
  `uuid`/`rdns`) are still surfaced by **synthesizing a complete `SpliceProviderInfo`** (F-FLAT-001):
  `uuid` is derived deterministically from `target` (so an old webext's re-announce churn dedupes to
  one entry under the normal `info.uuid` key), and `rdns` is set to the sentinel `'canton.legacy'` —
  a synthesized, non-authoritative identity. Pickers MUST treat a sentinel `rdns` (`canton.legacy`,
  like the injected `canton.injected`) as **non-persistable**: discoverable and usable, but not
  eligible for "remember last wallet". An accepted degradation until that webext updates; this is
  the payoff of the flat-additive wire.
- **REQ-DISC-004** — `requestProviders(onDetail: (d: SpliceAnnounceDetail) => void): (() => void) | undefined`
  (dApp side). MUST add the `canton:announceProvider` listener **before** dispatching
  `canton:requestProvider`, and MUST no-op (return `undefined`) when `typeof window === 'undefined'`.
  Mirrors `mipd/src/utils.ts:45-57`.
- **REQ-DISC-005** — `createDiscoveryStore(): Store` accumulating `DiscoveredWallet`s (each flat
  `SpliceAnnounceDetail` normalized on arrival, REQ-DISC-003): `getProviders()`,
  `subscribe(listener, { emitImmediately? })` with `{ added, removed }` meta,
  `findProvider({ rdns })`, `clear()`, `destroy()`, `reset()`. The store MUST dedupe incoming
  details by `info.uuid` and resolve `findProvider` by `info.rdns`; legacy details (normalized per
  REQ-DISC-003) carry a deterministic `target`-derived `uuid`, so the same `info.uuid` key dedupes
  re-announce churn uniformly — no separate legacy code path in the store. **Eager request
  lifecycle (mipd parity, DISC-FID-001):** the store MUST call `requestProviders` during
  construction and retain its unsubscribe, so it surfaces wallets that announced before any
  consumer subscribed; `reset()` MUST `clear()` then unsubscribe and re-`requestProviders`;
  `destroy()` MUST clear providers + listeners and unsubscribe from discovery events. Without
  the eager construction request a store can expose the full surface yet never observe an
  already-announced wallet. Mirrors `mipd/src/store.ts` (dedupe `:59`, find `:88`, eager
  `request()` on construction `:69`, `destroy` unsubscribe `:81-85`, `reset` re-request `:94-98`).
- **REQ-DISC-006** — `createProvider(detail: SpliceAnnounceDetail, opts?: TransportOptions): SpliceProvider`.
  THE BRIDGE: constructs a `SpliceProvider` (over `SpliceProviderBase`) backed by a
  `WindowTransport({ ...opts, target: detail.target })` with the push-event channel
  (`REQ-EVT-*`) wired, so `provider.on('txChanged', …)` fires. The announced `detail.target`
  is the authoritative routing key and MUST NOT be overridden by dApp-supplied opts. This is
  sigilry's substitute for mipd's `detail.provider`.
- **REQ-DISC-007** — injected fallback (announce-first; DISC-FID-002). Discovery normalizes both
  sources to `DiscoveredWallet`: announced → `getProvider = (opts) => createProvider(detail, opts)`;
  injected (`window.canton` present) → a synthesized `DiscoveredWallet` with
  `info.rdns === 'canton.injected'` and `getProvider = () => window.canton` (opts accepted by
  the interface but ignored because there is no transport). The synthesized injected entry is a
  **true fallback**: it is surfaced only when **no provider has announced**
  (the store holds zero announced details). Once any `canton:announceProvider` has been observed,
  the generic injected entry is suppressed — a wallet that both announces and injects (e.g. Send
  Connect) appears exactly once, via its announced `rdns`. This is the
  [[provider-announcement-first]] directive made concrete ("never `window.canton` reliance; the
  injected entry is a named fallback, not the default"). It is a **deliberate divergence from
  wagmi**, which _coexists_ configured/injected and EIP-6963-discovered connectors and dedupes
  them by `rdns` (`wagmi/packages/core/src/createConfig.ts:67-87,312-336`); sigilry cannot dedupe
  the injected entry by `rdns` because page-injected `window.canton` exposes no stable `rdns`
  (mirroring wagmi's targetless injected connector resolving `window.ethereum` without an `rdns`,
  `wagmi/packages/core/src/connectors/injected.ts:59-65`), so it gates on announce-_presence_
  rather than `rdns` collision. Among _announced_ providers the store keys stay mipd-aligned
  (F-DISC-001): duplicate announcements are deduped by `info.uuid` and looked up / "remembered"
  by `info.rdns` (REQ-DISC-005); two entries sharing an `rdns` but differing in `uuid` may coexist
  unless a higher tier coalesces them. There is no `rdns`-dedupe of announced entries.
- **REQ-DISC-008** — augment `WindowEventMap` with `canton:announceProvider` and
  `canton:requestProvider` (typed `CustomEvent`s). Mirrors `mipd/src/window.ts`.
- **REQ-DISC-009** — announced-wallet `DiscoveredWallet.getProvider(opts?: TransportOptions)` accepts
  `TransportOptions` so dApps can override `WindowTransport` request behavior such as timeout for
  human-paced approval RPCs (issue #83). Omitting opts is unchanged and uses
  `DEFAULT_TRANSPORT_OPTIONS` (`timeout: 30000`). The injected fallback accepts the optional
  argument for interface compatibility but ignores it because `window.canton` is not transport-backed.

## Requirements — Push-Event Channel (`REQ-EVT-*`)

- **REQ-EVT-001** — `WindowTransport` gains an always-on inbound notification listener,
  installed independently of any in-flight `submit()` and persisting for the transport's
  lifetime; it MUST be removed on last unsubscribe. Contrast the current per-request listener
  at `src/transport/window.ts:63-96`.
- **REQ-EVT-002** — the push envelope is the **id-less `SPLICE_WALLET_REQUEST`**:
  `{ type: SPLICE_WALLET_REQUEST, request: { jsonrpc: '2.0', method, params }, target? }`
  with `request.id` **absent**. This aligns to upstream `canton-network/wallet#1814` (MERGED
  2026-06-12, the id-less-notification "Option B"). It supersedes the `SPLICE_WALLET_EVENT`
  "Option A" envelope (see `docs/cip103-sync-push-events-proposal.md`), which the fixed
  `@canton-network/dapp-sdk` deliberately drops; interop with that SDK requires Option B.
- **REQ-EVT-003** — `id` presence is the sole direction discriminant on the shared
  `SPLICE_WALLET_REQUEST` channel: id present = dApp→wallet request; id absent = wallet→dApp
  notification. The request path MUST skip id-less frames (echo guard); the notification path
  MUST handle only id-less frames.
- **REQ-EVT-004** — the notification listener MUST drop frames whose `target` does not match
  the transport's configured `target` (when one is set). Symmetric with the announce target
  (REQ-DISC-002).
- **REQ-EVT-005** — delivery is via `provider.emit(method, params)` to listeners registered
  through `provider.on(method, …)`. It MUST NOT error when no listener is registered (emit
  no-ops on an empty set).
- **REQ-EVT-006** — `notify(event: string, payload: unknown, target?: string)` (wallet side):
  serializes an id-less `SPLICE_WALLET_REQUEST` notification — the push counterpart of the
  existing `submitResponse()` (`src/transport/window.ts:115-124`). Wallets call `notify`
  instead of hand-rolling the frame.
- **REQ-EVT-007** — `SpliceProviderBase` auto-wires the transport's notification channel to
  `.emit`, so a provider from `createProvider` (REQ-DISC-006) delivers events through `.on()`
  with no per-consumer wiring.
- **REQ-EVT-008** — event `method` names MUST be in the generated event set declared in
  `src/generated/schemas.ts`: the sync §4.2.2 three (`accountsChanged`, `statusChanged`,
  `txChanged`) plus the login-flow `connected` (see the taxonomy note in **Solution**); `params`
  MUST conform to that event's OpenRPC result schema. The generated artifact — not the CIP prose —
  is the validation authority. Unknown event names are dropped.
- **REQ-EVT-009** — concrete transport subscription surface + filtering split (EVT-FID-001). The
  notification leg adds one method to the transport contract alongside the existing
  `submit`/`submitResponse` (`src/transport/types.ts:13-34`) and the producer `notify`
  (REQ-EVT-006):
  `onNotification(listener: (method: string, params: unknown, meta: { target?: string }) => void): () => void`,
  returning an unsubscribe. Responsibilities are assigned to exactly one layer each, so neither is
  duplicated nor dropped:
  - **Transport layer** — drops any frame that is not an id-less notification (id-presence guard,
    REQ-EVT-003) and any frame whose `target` mismatches the configured `target` (REQ-EVT-004).
    Only surviving notifications are passed to `onNotification` listeners. The transport does NOT
    validate event names or parse payloads.
  - **Provider layer** (`SpliceProviderBase`, auto-wired per REQ-EVT-007) — validates the event
    `method` against `generated/schemas.ts` (REQ-EVT-008), and dispatches via `.emit` (REQ-EVT-005);
    unknown methods are dropped here, not in the transport.
  - **Lifecycle** — the always-on `window` listener (REQ-EVT-001) is installed lazily on the first
    `onNotification` subscription and removed when the last unsubscribes. Provider
    `removeListener`/`removeAllListeners` calls that drop the final event consumer MUST cascade to
    the transport unsubscribe, so no orphaned `window` listener leaks. This makes REQ-EVT-001's
    "removed on last unsubscribe" concrete: "last unsubscribe" == zero remaining `onNotification`
    listeners.

## Invariants

- `id` presence is the **only** direction discriminant on the `SPLICE_WALLET_REQUEST`
  channel. No second flag is introduced.
- announce `target` == transport `target` == routing key. A frame whose `target` mismatches
  is never dispatched (REQ-EVT-004) — and a wallet that sets `target` on announce MUST set the
  same `target` on its notifications.
- Discovery (`CustomEvent` on `window`) and transport (`postMessage`) are separate channels:
  discovery never carries RPC; the transport never carries discovery.
- The wallet never ships a provider implementation across the page boundary — only the flat
  `{ id, name, icon, target, rdns, uuid }` (metadata + routing key, never a provider object).

## Non-goals

- The React/wagmi tier (`@sigilry/react` hooks, config, `multiInjectedProviderDiscovery`-style
  connector store). Owned by `packages/react/SPEC.md`; this spec is its `mipd`/`viem` substrate.
- Wallet business logic — _when_ to emit each event and _what_ payload to compute. Owned by the
  wallet (Send Connect: `apps/webext/SPEC.md`). sigilry only provides `notify`'s serializer.
- Multi-wallet frame-authenticity hardening (forgery, per-session channel token, `MessagePort`
  transfer). Deferred — page-trust model accepted for now (proposal Open Q5). Flagged as an open item.
- The CIP-103 spec amendment itself (a separate upstream track in `canton-foundation/cips`).
- The retirement schedule for the legacy `SPLICE_WALLET_EVENT` frame — decided in the Send
  Connect SPEC (EVT-OI-1: clean break, deleted with the listener).

## Risk tags

- **[PUBLIC API CONTRACT]** New exports from `@sigilry/dapp` (`discovery` module,
  `createProvider`, transport `onNotification`/`notify`). Published-SDK surface → semver-minor;
  PLAN-gate approval required before TDD.
- **[WIRE CONTRACT]** The id-less `SPLICE_WALLET_REQUEST` notification becomes part of sigilry's
  _published_ wire contract. It MUST stay **shape-compatible** with merged `#1814` (same `type`,
  `request.{jsonrpc,method,params}`, `id` absent, `target`) or cross-impl interop
  (`@canton-network/dapp-sdk` ↔ Send Connect) breaks. ("Shape", not "byte": `postMessage`
  structured-clone has no canonical byte form — F-CAL-001. To make this testable, check a
  serialized `#1814` fixture into the repo and assert against it.)
- **[SUPERSEDES]** `docs/cip103-sync-push-events-proposal.md` recommended Option A
  (`SPLICE_WALLET_EVENT`); this spec adopts Option B per the upstream merge. That proposal doc is
  marked superseded as of 2026-06-13 (drift surfaced and resolved, not silently dropped).
- **[COORDINATED CHANGE → additive]** Adding `rdns`/`uuid` is an **additive superset** of the
  current `{ id, name, icon, target }` — nothing is removed, so an existing reader keeps working
  and a pre-discovery webext (no `rdns`/`uuid`) stays discoverable (REQ-DISC-003). The remaining
  coordination is light: land the sigilry helper (normalizer) and the webext adopter (emitter)
  together so both agree on the new fields. There is **no breaking announce transition** to stage.
  (Resolves the announce-shape half of Send Connect EVT-OI-4.)

## Acceptance criteria

- [x] `announceProvider`/`requestProviders`/`createDiscoveryStore`/`createProvider` exported from a
      new `@sigilry/dapp/discovery` entry, mirroring mipd's `store`/`utils` surface.
- [x] Store dedupes by `info.uuid` and resolves `findProvider` by `info.rdns`.
- [x] The announce wire detail is **flat** `{ id, name, icon, target, rdns, uuid }`; the store
      normalizes it into a **complete** `DiscoveredWallet.info`. A legacy detail missing `rdns`/`uuid`
      is still surfaced via a synthesized complete `info` (deterministic `target`-derived `uuid`;
      sentinel `rdns: 'canton.legacy'`), proving the additive shape is back-compat without a partial
      consumer type. Re-announce churn from a legacy webext dedupes to one entry.
- [x] `requestProviders` subscribes before dispatching and no-ops under SSR.
- [x] `createProvider(detail)` yields a `SpliceProvider` whose `.on('txChanged', …)` fires on a
      target-matched id-less notification, and does **not** fire on a target-mismatched one.
- [x] `WindowTransport` notification listener is always-on (delivers with no `submit()` in flight),
      installed lazily on the first `onNotification` subscription, and removed on the last
      unsubscribe; provider `removeAllListeners` cascades to the transport unsubscribe (no orphaned
      `window` listener).
- [x] Transport-layer filtering (id-presence + target) vs provider-layer validation (event-name +
      emit) are split per REQ-EVT-009: an id-carrying or target-mismatched frame never reaches
      `onNotification`; an unknown event-name reaches `onNotification` but is dropped before `.emit`.
- [x] Request path skips id-less frames (no echo); notification path ignores id-carrying frames.
- [x] `createDiscoveryStore()` discovers a wallet that announced _before_ the store was constructed
      (eager construction request, REQ-DISC-005); `reset()` re-requests; `destroy()` unsubscribes.
- [x] With one announced provider present, the synthesized injected fallback entry is suppressed
      (announce-first, REQ-DISC-007); with zero announced providers and `window.canton` present,
      exactly one `canton.injected` fallback entry is surfaced.
- [x] `notify('txChanged', payload, target)` emits an id-less `SPLICE_WALLET_REQUEST` whose shape
      is shape-compatible with merged `#1814` (asserted against a checked-in `#1814` fixture).
- [x] Injected fallback: with only `window.canton` present, discovery surfaces one
      `DiscoveredWallet` (`rdns: 'canton.injected'`); with both, the announced entry wins.
- [x] `WindowEventMap` augmented; no `any` on the discovery event types.
- [x] Announced-wallet `getProvider({ timeout })` forwards `TransportOptions` into the transport,
      while `getProvider()` keeps the default 30s timeout and the injected fallback ignores opts.

## Open items

1. **Legacy `SPLICE_WALLET_EVENT`. RESOLVED 2026-06-13: clean break** (Send Connect SPEC EVT-OI-1).
   The webext deletes the legacy frame the same release its listener is removed; no dual-emit.
   sigilry's `notify` emits Option B only regardless, so no SDK change follows from this.
2. **`docs/cip103-sync-push-events-proposal.md`. RESOLVED 2026-06-13: marked superseded** (Option A
   `SPLICE_WALLET_EVENT` → Option B id-less notification, per the #1814 merge). The doc header now
   carries a superseded banner pointing to this spec, the webext SPEC, and #1814.
3. **Frame authenticity** (proposal Open Q5b) — page script can forge id-less frames; target-filter
   does not stop forgery. Out of scope here; revisit with the multi-wallet discovery CIP.
4. **`statusChanged` artifact _versioning_** (not payload shape — F-EVT-002). The payload is
   defined: CIP-103 specifies `StatusEvent` (`cip-0103.md:313-315`); the OpenRPC maps it to
   `StatusChangedEvent` (`api-specs/openrpc-dapp-api.json:191-199`); the generated schema exists
   (`generated/schemas.ts:54`). The only open question is which upstream OpenRPC revision sigilry
   pins, since `REQ-EVT-008` validates against whatever `generated/schemas.ts` is regenerated from.

## Cross-references

- wevm reference: `~/0xbigboss/wevm/mipd/src/{store,utils,types,window}.ts`.
- Event-channel prior art (Option A, **superseded**): `docs/cip103-sync-push-events-proposal.md`.
- Upstream merge (Option B): `canton-network/wallet#1814` (merge `33788a79`).
- Consumer / wallet side: Send Connect `apps/webext/SPEC.md`.
- Current sigilry surface this extends: `src/transport/window.ts`, `src/provider/{base,interface}.ts`,
  `src/messages/events.ts`, `src/generated/schemas.ts`.
