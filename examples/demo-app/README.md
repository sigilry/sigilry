# Sigilry Demo App

This directory documents the **first SDK implementation example** for Sigilry. It is written for developers new to Canton/DAML who want a clear, runnable reference and well-commented patterns they can copy into their own apps.

Docs site: https://sigilry.org

## Demo App Overview

The demo app is a **self-contained SDK showcase** with a split-pane UI: a dApp pane on the left and a mock wallet simulator on the right. The wallet runs in-browser for approvals, while contract reads/writes use a real local DAML sandbox JSON API.

## Canton Stack Mental Model

This example follows the same layering used in Canton ecosystem projects:

- **DAML SDK** compiles contracts (`daml/`, `daml.yaml`) into a DAR.
- **Canton-compatible wallet/provider** exposes typed JSON-RPC at `window.canton`.
- **Sigilry SDK** (`@sigilry/dapp`, `@sigilry/react`, `@sigilry/cli`) bridges dApp code to provider RPC and typed contract bindings.

If you are new to Canton, read this demo as: `DAML model -> DAR -> generated TypeScript -> React hooks -> provider RPC -> ledger updates`.

## What You Will Learn

- How a dApp talks to a wallet via `window.canton` and typed RPC methods
- How the `@sigilry/react` hooks map to the provider flow
- How `@sigilry/cli` generates TypeScript types from DAML DARs
- How the demo app combines wallet approvals with a real sandbox ledger

## Quick Start (Demo App)

From the repo root:

```bash
# Reproducible toolchain (dpm, bun, fnm, JDK)
nix develop

# Install workspace deps
yarn install

# Start demo (builds CLI, generates bindings, runs sandbox + Vite)
yarn --cwd examples/demo-app dev
```

> **Tip:** With [direnv](https://direnv.net/) + [nix-direnv](https://github.com/nix-community/nix-direnv) installed, the Nix environment loads automatically when you `cd` into the repo. Run `direnv allow` once to trust the `.envrc`, then skip `nix develop` on future visits.

Optional: refresh the DAR when contracts change (DARs are committed):

```bash
dpm build -o dars/demo-todo-package-0.0.1.dar
```

The demo app runs a split-pane UI:

- Left pane: dApp UI using `@sigilry/react` hooks
- Right pane: in-browser wallet simulator (key generation + approval queue)

## Prerequisites & Run Commands

Prerequisites:

- Recommended: `nix develop` from the workspace root to provision `dpm`, `bun`, `fnm`, and the TypeScript toolchain.
- Alternative (no Nix): Node.js + Yarn (workspace scripts) and DAML SDK with `dpm` available.
- Secure browser context (HTTPS or localhost) for Web Crypto Ed25519.
- DAML `sdk-version` for this demo is `3.4.9` (`examples/demo-app/daml.yaml`).

### Version Alignment (Important)

Keep DAML/Canton toolchain versions aligned when moving from demo to real networks:

- LF/package IDs are content-hash based and include compiler/target details.
- Building the same contracts with different SDK/LF targets can produce different package IDs.
- For local learning, this repo's pinned flow (`nix develop` + `dpm`) avoids accidental drift.

For repo-wide build/test workflows, see [README.md](../../README.md#development).

Nix dev shell (recommended):

- From the workspace root, run `nix develop`, then run the commands below.
- From this directory, you can also run `nix develop ../..` to enter the same dev shell.
- To refresh the committed DAR before a demo build, run `dpm build -o dars/demo-todo-package-0.0.1.dar`.
- `yarn setup` builds the CLI and generates bindings; `yarn dev` runs setup automatically.

Demo app commands (from this directory):

- `yarn dev` - Build CLI + generate bindings + start sandbox + Vite (http://localhost:5173)
- `yarn setup` - Build CLI and generate TypeScript bindings only
- `yarn dev:ledger` - Start Canton sandbox with bootstrap provisioning
- `yarn dev:frontend` - Start Vite only
- `yarn build` - Production build
- `yarn preview` - Preview production build
- `yarn typecheck` - TypeScript type checking
- `yarn codegen` - Generate TypeScript bindings from the DAR
- `dpm build -o dars/demo-todo-package-0.0.1.dar` - Refresh the committed DAR (optional)

Optional sandbox port overrides (all default values are set in `package.json`):

- `SANDBOX_JSON_API_PORT`
- `SANDBOX_LEDGER_API_PORT`
- `SANDBOX_ADMIN_API_PORT`
- `SANDBOX_SEQUENCER_PUBLIC_PORT`
- `SANDBOX_SEQUENCER_ADMIN_PORT`
- `SANDBOX_MEDIATOR_ADMIN_PORT`
- `SANDBOX_JSON_API_URL` (overrides Vite proxy target directly)
- `VITE_LEDGER_PARTY_ID` (defaults to `Alice`)
- `VITE_LEDGER_USER_ID` (defaults to `ledger-api-user`)
- `VITE_LEDGER_API_BASE_PATH` (defaults to `/ledger`)
- `CANTON_JAR` (overrides Canton JAR path; defaults to `~/.dpm/cache/components/canton-enterprise/3.4.9/lib/canton-enterprise-3.4.9.jar`)

## Ledger Bootstrap Provisioning

`yarn dev:ledger` runs `scripts/dev-ledger.sh` and executes two distinct phases.

Sandbox startup responsibilities (handled by `scripts/dev-ledger.sh` via `canton sandbox`):

1. Initialises the `sandbox-synchronizer` topology (sequencer + mediator).
2. Uploads the demo DAR (`dars/demo-todo-package-0.0.1.dar`).
3. Starts Ledger API / JSON API / admin endpoints and waits for readiness.

Bootstrap script responsibilities (handled by `scripts/bootstrap-demo-ledger.canton` via `canton sandbox-console --bootstrap`):

1. Allocates (or reuses) the party specified by `VITE_LEDGER_PARTY_ID` (default: `Alice`).
2. Creates (or reuses) the user specified by `VITE_LEDGER_USER_ID` (default: `ledger-api-user`).
3. Grants `actAs` and `readAs` rights for that party to that user.
4. Prints a readiness banner and exits.

The bootstrap script does not initialise synchronizer topology and does not upload DARs; those are sandbox startup responsibilities.
Bootstrap steps are idempotent -- restarting `dev:ledger` on an already-bootstrapped sandbox is safe.

The Canton JAR is resolved from `~/.dpm/cache/components/canton-enterprise/3.4.9/lib/canton-enterprise-3.4.9.jar` by default. Override with the `CANTON_JAR` env var when using a different Canton installation.

## DAML -> TypeScript Workflow

1. Update contracts in `examples/demo-app/daml/TodoList.daml`.
2. Build DAR: `dpm build -o dars/demo-todo-package-0.0.1.dar`.
3. Regenerate bindings: `yarn setup` (or just restart `yarn dev`).
4. Import generated templates from `examples/demo-app/src/generated`.

The dApp uses generated template identifiers so UI actions map directly to DAML choices without stringly-typed RPC calls.

## Split-Pane Behavior

- Desktop layout: fixed side-by-side panes with a non-resizable divider; dApp pane on the left, wallet pane on the right.
- Mobile layout: panes stack vertically with the dApp pane first and the wallet pane second.
- Wallet loading state: while keypair generation runs, show a clear loading state and disable approval actions.
- Account summary: display the party id and a shortened public-key fingerprint derived from the generated keypair.
- Approval queue: render oldest-first (FIFO) with a clear empty-state message when no approvals exist.

## Core Flows

- Connect/disconnect toggles the mock wallet connection and updates connection status + account list.
- Adding a todo in the dApp exercises `TodoList.AddItem` (factory) and triggers an approval request in the wallet pane.
- Approve resolves the request, submits to the sandbox ledger, and updates the todo list.
- Reject returns an RPC error and surfaces a user-visible error in the dApp pane (no todo added).
- RPC log shows each request with its pending-to-result/error lifecycle.

## Technical Behaviors

- Generate an Ed25519 keypair on load using `window.crypto.subtle.generateKey`.
- Derive the party id from the public-key fingerprint (SHA-256, first 68 hex chars).
- Execute ledger commands as the fixed local sandbox party `Alice` unless `actAs` is explicitly provided.
- Emit provider events to keep UI in sync: `connect`, `disconnect`, `accountsChanged`, `txChanged`.
- Void methods omit `params` entirely (`status`, `connect`, `disconnect`, `listAccounts`, `getPrimaryAccount`, `getActiveNetwork`).

## Error States

- If Ed25519 or Web Crypto is unavailable (or the page is not a secure context), show an unsupported state and disable wallet actions.
- Rejected approvals return a provider error and surface a user-visible message in the dApp pane.

## Troubleshooting (First-Time Canton Users)

- `Ed25519 unsupported`: run on `localhost`/HTTPS and use a browser with Web Crypto Ed25519 support.
- `No accounts loaded yet`: click **Connect wallet** first; accounts are only emitted after provider connect.
- No todos after approval: confirm sandbox is running (`yarn dev` or `yarn dev:ledger`) and check `SANDBOX_JSON_API_PORT` / `SANDBOX_JSON_API_URL` alignment.
- Tooling mismatch: re-enter `nix develop`, run `dpm build -o dars/demo-todo-package-0.0.1.dar` if needed, then rerun `yarn dev` (or `yarn setup` to regenerate bindings only).
- `UNKNOWN_INFORMEES` on command submit: the `actAs` party is not provisioned on the sandbox synchronizer, or the submitting user lacks the required rights. Restart the ledger stack (`yarn dev:ledger`) to run bootstrap provisioning. If using a custom party, ensure `VITE_LEDGER_PARTY_ID` is set before starting the ledger. The enriched error message includes the submitted `actAs` parties and `userId` for diagnosis.
- Canton JAR not found: install Canton via `dpm` or set `CANTON_JAR` to the path of an existing `canton-enterprise-*.jar`.

## Canton/DAML Quick Primer (First-Time Friendly)

- **DAML** is the smart contract language.
- A **DAR** is the compiled DAML package you deploy or generate types from.
- A **Template** defines a contract type; a **Choice** is a method you can exercise.
- A **Factory template** creates other contracts via choices (for example, `TodoList.AddItem` creates `TodoItem`).
- A **Party** is an identity on the ledger, used for `actAs` in commands.

## SDK Pattern: `@sigilry/dapp`

The dApp-facing API is a provider exposed on `window.canton` (EIP-1193 style). Requests are **typed** and only accept canonical RPC methods.

```ts
// dapp.ts
import type { RpcMethodName } from "@sigilry/dapp/provider";

const provider = window.canton; // Injected by a wallet extension or demo mock

// Methods without params omit `params` entirely (typed payload)
const status = await provider.request({ method: "status" });
// status is a typed StatusEvent result

if (!status.connection.isConnected) {
  await provider.request({ method: "connect" });
}

// Methods with params are typed by method name
const accounts = await provider.request({
  method: "listAccounts",
});

// Subscribe to provider events to keep UI in sync
provider.on("accountsChanged", (wallets) => {
  // wallets is typed by the runtime schema
  console.log("Active wallets", wallets);
});

provider.on("txChanged", (tx) => {
  // tx status transitions: pending -> signed -> executed/failed
  console.log("Transaction update", tx);
});
```

Key takeaways:

- Use the **literal method name** to get typed params/results.
- Void methods **must not** include `params: {}`.
- Use provider events for realtime UI updates.

## SDK Pattern: `@sigilry/react`

The React package wraps the provider with `CantonReactProvider` and exposes hooks that map to RPC methods.

```tsx
// src/main.tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CantonReactProvider } from "@sigilry/react";

const queryClient = new QueryClient();

export function AppRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* CantonReactProvider reads window.canton at render time */}
      <CantonReactProvider>
        <App />
      </CantonReactProvider>
    </QueryClientProvider>
  );
}
```

```tsx
// src/components/ConnectionStatus.tsx
import { useCantonProvider, useConnect, useDisconnect, useAccounts } from "@sigilry/react";

export function ConnectionStatus() {
  const { connectionState } = useCantonProvider(); // local connection state
  const { connect, isPending } = useConnect(); // calls provider.request('connect')
  const { disconnect } = useDisconnect(); // calls provider.request('disconnect')
  const { data: accounts } = useAccounts(); // mirrors listAccounts

  if (connectionState.status === "disconnected") {
    return (
      <button onClick={connect} disabled={isPending}>
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div>
      <span>Connected: {accounts?.[0]?.partyId}</span>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

```tsx
// src/components/TodoList.tsx
import { useActiveContracts, useExerciseChoice } from "@sigilry/react";

export function TodoList() {
  const { data: contracts, isLoading } = useActiveContracts({
    templateFilter: {
      packageName: "demo-todo-package", // package name from DAML
      moduleName: "TodoList",
      entityName: "TodoItem",
    },
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <ul>
      {contracts?.map((contract) => (
        <TodoItem key={contract.contractId} contract={contract} />
      ))}
    </ul>
  );
}

function TodoItem({
  contract,
}: {
  contract: { contractId: string; templateId: string; payload: any };
}) {
  const { exercise, isPending } = useExerciseChoice();

  return (
    <li>
      <span>{contract.payload.description}</span>
      <button
        disabled={isPending}
        onClick={() =>
          // Choice name must match DAML choice (e.g. Complete)
          exercise({
            contractId: contract.contractId,
            templateId: contract.templateId,
            choice: "Complete",
            choiceArgument: {},
          })
        }
      >
        {isPending ? "..." : "✓"}
      </button>
    </li>
  );
}
```

In the demo app, new todos are created by exercising `TodoList.AddItem` on the factory contract, then `TodoItem` contracts are observed via `useActiveContracts`.

Key takeaways:

- Hooks are thin wrappers around `window.canton.request()`.
- `useActiveContracts` and `useExerciseChoice` show the **read + write** pattern.
- Use React Query state (`isLoading`, `isPending`) for UI feedback.

## SDK Pattern: `@sigilry/cli` (DAML → TypeScript)

The CLI wraps the DAML SDK codegen so your dApp gets typed contract bindings.

```ts
// sigilry.config.ts
import { defineConfig } from "@sigilry/cli/config";

export default defineConfig({
  // One or more DARs to generate from
  dars: ["./dars/demo-todo-package-0.0.1.dar"],

  // Generated TS files live here
  output: "./src/generated",

  // Cleanup output before generating
  cleanup: true,

  // Watch for DAR changes (optional)
  watch: false,
});
```

```bash
# Build DAML into a DAR

dpm build -o dars/demo-todo-package-0.0.1.dar

# Generate TypeScript bindings

sigilry codegen --config ./sigilry.config.ts
```

Key takeaways:

- **DARs are the input**, TypeScript types are the output.
- The CLI validates DAR paths and runs `dpm codegen-alpha-typescript` for you.
- Use watch mode during active DAML development.

## How the Demo App Uses These Patterns

Files to explore:

- `examples/demo-app/src/providers/MockProvider.tsx` — wallet provider wired to approvals + sandbox calls
- `examples/demo-app/src/lib/ledger-http.ts` — HTTP adapter for `ledgerApi` and command submission
- `examples/demo-app/src/providers/WalletSimulator.tsx` — keypair creation and approval queue
- `examples/demo-app/src/components/dapp/` — hook usage in the dApp pane
- `examples/demo-app/src/components/wallet/` — approval UI in the wallet pane

## Why the Demo Uses a Mock Wallet

To make the first SDK example approachable:

- The wallet runs in the same browser tab (no extension required).
- Approval flows are visible, so you can see `prepareExecuteAndWait` in action.
- The provider still uses the **real** `@sigilry/dapp` request types and events.
- Ledger reads/writes execute against a real local DAML sandbox.

## Examples Gallery

In addition to the Todo integration on the **Todo Integration** tab, the demo app ships three polished examples that mirror the browser-console patterns external teams currently reference. Each example is a React component that uses `@sigilry/react` hooks exclusively; there is no direct `window.canton.request(...)` escape hatch except where documented.

| Tab              | Hook stack                                                                                           | What it demonstrates                                                        |
| ---------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Active Contracts | `useConnect`, `useActiveAccount`, `useActiveContracts()`                                             | Connect, fetch all active contracts (wildcard), group by template id.       |
| Sign Message     | `useSignMessage`, `useActiveAccount`, `verifySignature` (Web Crypto)                                 | Request a wallet signature; verify it client-side against the account key.  |
| USDCx Transfer   | `useActiveAccount`, `useLedgerApi` (interface filter), `useSubmitCommand`, `useCanton().onTxChanged` | Token-standard transfer: query holdings, build protobuf Value JSON, submit. |

The USDCx demo uses `useLedgerApi` as a documented escape hatch for the Holding interface-filter query because `useActiveContracts` does not yet support `interfaceFilters`. See `src/examples/usdcx-transfer/UsdcxTransferExample.tsx` and `src/lib/usdcx-holdings.ts` for the full flow, and `src/lib/protobuf-value.ts` for the typed protobuf-Value helpers shared with any token-standard integration.

The reusable utility modules added alongside the gallery:

- `src/lib/ecdsa-verify.ts` — typed Web Crypto wrapper for verifying `signMessage` signatures from the local Ed25519 simulator and ECDSA P-256 wallets.
- `src/lib/protobuf-value.ts` — typed builders for the protobuf Value JSON format Canton ISS expects in `prepareExecuteAndWait` choice arguments.
- `src/lib/usdcx-holdings.ts` — hook-free loader and holding-selection utility for the USDCx instrument.

## Next Steps

- Follow the full docs at https://sigilry.org
- Explore hook and provider source code in `packages/react/src` and `packages/dapp/src`
