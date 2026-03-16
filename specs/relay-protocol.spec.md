# Sigilry Relay Protocol (SRP) Specification

Tagline: A chain-agnostic relay for approvals anywhere.

“What hath God wrought?” — Samuel F. B. Morse, first telegraph message, May 24, 1844

## Overview

Sigilry Relay Protocol (SRP) provides remote wallet connectivity for dApps that do not have the browser extension installed. SRP supports:

- Browser dApps (no extension)
- Terminal/agent workflows via CLI (e.g., Claude Code, Codex)
- Mobile approvals through the wallet web app

SRP preserves the existing Canton JSON-RPC dApp API and adds a transport + session layer that is chain-agnostic. The relay service is closed source; SDKs and wallet clients remain open source.

**Note:** Current implementation work targets the **sync** dApp API only. Relay/async API support is future work and should track the async spec when implemented.

## Audience

Primary audience: terminal coding agents and developers integrating wallet connectivity into dApps and CLIs. Secondary audience: wallet team implementing the web app receiver and approval UI.

## Goals

- Provide seamless connection without extension via relay pairing and sessions.
- Keep the existing OpenRPC dApp API stable.
- Support full RPC flow: status/connect/getActiveNetwork/listAccounts/getPrimaryAccount/prepareExecute/prepareExecuteAndWait/signMessage/ledgerApi plus events.
- Support approvals on a mobile device using the wallet web app.
- Make transports and identifiers chain-agnostic for future chain expansion.

## Non-Goals

- Replacing the extension flow.
- Expanding or changing the canonical OpenRPC method surface.
- Cross-device session resume (not supported by default).
- Open-sourcing the relay implementation.

## Current System Context

- `@sigilry/dapp` defines provider, RPC client/server, and message schemas.
- Only `WindowTransport` exists today; extension injects `window.canton`.
- The web app handles approvals via an extension-only approval bridge.

This spec introduces a relay transport and wallet receiver flow that reuses the existing RPC method definitions.

## Provider Compatibility (window.canton + window.ethereum)

SRP must coexist with existing provider expectations:

- **`window.canton`** remains the primary Canton provider for browser dApps.
- **`window.ethereum`** may also exist for EVM wallets. SRP must not interfere.

Design requirements:

- **No breaking changes** to `window.canton` injection behavior.
- **Auto-connector** should prefer `window.canton` when present, and fall back to relay otherwise.
- **Explicit provider selection** should be supported (dApp can force relay or extension).
- **Namespace isolation**: SRP should not claim or polyfill `window.ethereum`.

## DApp Integration Options

SRP does not impose automatic provider selection. dApps opt in by choosing one of the integration modes below:

1. **Extension-only (existing behavior — available today)**
   - dApp reads `window.canton` directly.
   - No relay usage or pairing UI.

2. **Relay-only (explicit SRP — not implemented)**
   - dApp constructs a `RelayProvider` and uses it directly.
   - dApp owns pairing UI (QR/deeplink) or uses CLI flow.

3. **Auto-connector (SDK helper — not implemented)**
   - dApp uses a Sigilry connector that checks `window.canton` first.
   - If not present, connector exposes pairing UI hooks for SRP.
   - This is optional and must be explicitly adopted by the dApp.

## Provider Selection Logic (Connector Mode Only)

If a dApp opts into the Sigilry connector, the default selection is:

1. If `window.canton` is present and healthy, use it.
2. Else, offer SRP pairing (QR/deeplink/CLI).
3. If both are present, allow the dApp or user to choose (configurable).

This keeps compatibility with existing Canton dApps and avoids collisions with EVM wallets while making relay support an explicit opt-in.

## Spec Map (Placeholder Specs)

The following specs do not exist yet and must be defined before implementation. Placeholder files are created to track scope and ownership:

- `specs/srp-sdk.spec.md` — RelayTransport, RelayProvider, connector APIs (placeholder)
- `specs/srp-crypto.spec.md` — encryption, key exchange, message envelopes (placeholder)
- `specs/srp-relay-service.spec.md` — relay service routing, topics, rate limits (placeholder)
- `specs/srp-wallet-ui.spec.md` — wallet web app pairing + approval UX (placeholder)
- `specs/srp-cli.spec.md` — CLI pairing flow and localhost UI (placeholder)
- `specs/srp-permissions.spec.md` — permissions policy, scopes, enforcement (placeholder)
- `specs/srp-webrtc.spec.md` — optional WebRTC transport (placeholder)

## Chain-Agnostic Identifiers

All new relay/session metadata uses CAIP identifiers:

- **Chain ID**: CAIP-2 (e.g., `canton:localnet`, `canton:da-mainnet`)
- **Account ID**: CAIP-10 (e.g., `canton:localnet:cantonwallet-alice::1220...`)

Compatibility mapping:

- Existing `networkId` fields are treated as CAIP-2.
- Existing `partyId` fields map to the account component of CAIP-10.

## Permissions Model

### Principles

- Least privilege by default.
- Explicit user consent for sensitive actions.
- Wallet enforces permissions; relay is blind to content.

### Scopes

Scopes map 1:1 to RPC methods or events:

- `core:status` → `status`
- `core:connect` → `connect`
- `core:disconnect` → `disconnect`
- `accounts:read` → `listAccounts`
- `accounts:primary` → `getPrimaryAccount`
- `network:read` → `getActiveNetwork`
- `accounts:events` → `accountsChanged`
- `tx:execute` → `prepareExecute`, `prepareExecuteAndWait`
- `sign:message` → `signMessage`
- `tx:events` → `txChanged`
- `ledger:proxy` → `ledgerApi`

### Constraints

- `chains`: allowlist of CAIP-2 chains
- `accounts`: allowlist of CAIP-10 accounts
- `primaryOnly`: if true, restricts to primary account
- `ledgerApiAllowlist`: allowlist of ledger API endpoints/commands

### Approval Policy (Default)

- `status`, `listAccounts`, `getActiveNetwork`: auto after connection
- `connect`: user approval (pairing approval)
- `prepareExecute`, `prepareExecuteAndWait`: always prompt
- `signMessage`: always prompt
- `ledgerApi`: prompt unless allowlisted

### Enforcement

- Wallet client validates scope + constraints before dispatching.
- Denied calls return JSON-RPC `UNAUTHORIZED` (4100) or `UNSUPPORTED_METHOD` (4200).

## Architecture

Actors:

- **dApp Client**: browser or CLI
- **Wallet Client**: web app UI (phone or desktop)
- **Relay Service**: Sigilry relay (closed source)

Channels:

- **Pairing channel**: ephemeral; negotiates session
- **Session channel**: encrypted; carries JSON-RPC requests/responses/events

Core components:

1. Relay service (WS) routes encrypted messages by topic.
2. Relay transport in SDK sends JSON-RPC payloads over session.
3. Wallet receiver accepts pairing and handles RPC + approvals.

## Transport Options

### Baseline: WebSocket Relay

- Minimal infra, reliable, easy to implement.
- Supports browser + CLI environments.
- Matches current JSON-RPC request/response model.

### Future Option: WebRTC Data Channels

- Requires relay-based signaling + STUN/TURN.
- Adds complexity and reliability risks on mobile/NAT.
- Optional Phase 2: attempt WebRTC after pairing; fallback to relay WS.

## Protocol (SRP v0.1)

### Pairing Flow

1. dApp generates pairing keypair and `pairingTopic`.
2. dApp publishes `PAIRING_INIT` on relay.
3. Wallet scans QR or opens deep link with `pairingTopic`.
4. Wallet fetches proposal, shows approval UI.
5. Wallet approves, sends `PAIRING_APPROVE` with wallet pubkey.
6. Both derive session key; create `sessionTopic`.

### Session Flow

- All RPC calls are encrypted JSON-RPC payloads over `sessionTopic`.
- Wallet publishes events on the same session topic.

### Message Shapes (Encrypted Payloads)

Pairing init:

```
{
  type: "PAIRING_INIT",
  nonce,
  timestamp,
  dapp: { name, url, icon, origin },
  requestedScopes: string[],
  chains: string[],
  constraints?: { chains?, accounts?, primaryOnly?, ledgerApiAllowlist? }
}
```

Pairing approve:

```
{
  type: "PAIRING_APPROVE",
  wallet: { name, url, icon },
  walletPubKey,
  sessionTopic,
  approvedScopes: string[],
  approvedChains: string[],
  approvedAccounts?: string[],
  expiry
}
```

Session RPC:

```
{
  type: "SESSION_RPC",
  id,
  jsonrpc: "2.0",
  method,
  params
}
```

Session event:

```
{
  type: "SESSION_EVENT",
  event: "accountsChanged" | "txChanged",
  payload
}
```

## UX Flows

### Browser dApp (no extension)

1. Connector detects no `window.canton`.
2. dApp UI shows QR + approval URL (relay pairing).
3. User approves on phone wallet web app.
4. Session established; dApp can call full RPC.

### CLI / Terminal Agent

1. CLI `sigilry relay connect` starts local UI (`localhost:{session_port}`) and prints QR + URL.
2. User scans QR in wallet web app.
3. Session established; agent can call RPC via relay transport.

### Mobile Approval

- Wallet web app receives `prepareExecute` request, shows approval UI, signs, and returns result.
- `txChanged` events propagate to dApp via session channel.

## SDK & Client Changes

### `@sigilry/dapp`

- Add `RelayTransport` implementing `RpcTransport`.
- Add `RelayProvider` (extends `SpliceProviderBase`) using relay transport.
- Add relay message types (separate from canonical OpenRPC).

### `@sigilry/react`

- Allow provider injection: `CantonReactProvider({ provider })`.
- Optional: `useCantonConnector({ mode, relayConfig, onPairingUri })`.

## Wallet Web App Changes

- Add "Relay Pairing" screen for QR/deep-link approval.
- Add session manager to handle:
  - pairing approval
  - permission enforcement
  - RPC handling
  - event publishing
- Reuse existing signing/approval logic for `prepareExecute`.

## Security

- End-to-end encryption between dApp and wallet.
- Explicit user approval for pairing and transactions.
- Origin/metadata displayed to user during pairing.
- Session TTL with explicit revoke.
- Rate limiting and message size limits on relay.

## Session Resume

Cross-device session resume is not supported by default. Sessions are bound to the approving wallet client. Local resume on the same client may be allowed if it does not change security posture.

## Open Questions

- Should `prepareExecute` / `prepareExecuteAndWait` require approval by default, or allow auto within scope?
- Minimal safe allowlist for `ledgerApi` if enabled?
- Whether to add session scope upgrade flow in v0.2?

## Implementation Plan (High-Level)

1. Define SRP v0.1 message envelope + encryption scheme.
2. Implement `RelayTransport` and `RelayProvider` in `@sigilry/dapp`.
3. Add provider injection into `@sigilry/react`.
4. Build wallet web app pairing + session manager.
5. Integrate with test-dapp and CLI flow.
6. Add full `prepareExecute` approval with events.
