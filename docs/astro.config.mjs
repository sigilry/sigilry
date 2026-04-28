import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import sitemap from "@astrojs/sitemap";
import starlightLlmsTxt from "@0xbigboss/starlight-llms-txt";
import starlightTypeDoc, { typeDocSidebarGroup } from "starlight-typedoc";

const SITE_URL = process.env.DOCS_SITE_URL ?? "https://sigilry.org";
const BASE_PATH = process.env.DOCS_BASE_PATH ?? "/";
const normalizedBase = BASE_PATH.startsWith("/") ? BASE_PATH : `/${BASE_PATH}`;
const base = normalizedBase.endsWith("/") ? normalizedBase : `${normalizedBase}/`;

export default defineConfig({
  site: SITE_URL,
  base,
  integrations: [
    sitemap(),
    starlight({
      title: "Sigilry",
      description: "Chain-agnostic dApp infrastructure for building wallet connections",
      logo: {
        light: "./src/assets/logo-lockup-dark.svg",
        dark: "./src/assets/logo-lockup-light.svg",
        alt: "Sigilry",
        replacesTitle: true,
      },
      favicon: "/favicon.png",
      disable404Route: true,
      expressiveCode: {
        themes: ["vitesse-dark", "vitesse-light"],
        styleOverrides: {
          borderRadius: "8px",
          codeFontFamily: "'JetBrains Mono', ui-monospace, monospace",
        },
      },
      plugins: [
        starlightLlmsTxt({
          details: `## What sigilry is

Sigilry is a [CIP-103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)-compliant dApp connectivity library for Canton Network. CIP-103 is the approved Canton standard for dApp ↔ wallet JSON-RPC. Sigilry implements the CIP-103 dApp API as typed TypeScript clients/servers, ships generated Zod schemas for runtime validation, and exposes React Query hooks.

## Packages

- **@sigilry/dapp**: CIP-103 provider interface (\`SpliceProvider\`), RPC client/server, message schemas, transports (Window, HTTP, WS).
- **@sigilry/react**: React Query hooks (useConnect, useAccounts, useSession) and CantonReactProvider on top of \`@sigilry/dapp\`.
- **@sigilry/cli**: TypeScript codegen from DAML DARs.
- **@sigilry/splice-dars**: Vendored Splice DAR files with typed path exports for Canton Network development.

## Quick integration

\`\`\`ts
async function connect() {
  const status = await window.canton.request({ method: "status" });
  if (!status.connection.isConnected) {
    await window.canton.request({ method: "connect" });
  }
  return await window.canton.request({ method: "listAccounts" });
}
\`\`\`

## CIP-103 method surface (sigilry implementation)

| CIP-103 method | Description |
|--------|-------------|
| status | Get connection state |
| connect | Initiate wallet connection (returns ConnectResult) |
| disconnect | End wallet session |
| isConnected | Check connection state without prompting |
| listAccounts | Get authorized accounts |
| getPrimaryAccount | Get the primary account |
| getActiveNetwork | Get the active Canton network |
| prepareExecute | Prepare, sign, and execute a transaction |
| prepareExecuteAndWait | prepareExecute, then await completion |
| signMessage | Sign an arbitrary message |
| ledgerApi | Pass-through to Canton Ledger API v2 |
| accountsChanged (event) | Subscribed via provider.on |
| txChanged (event) | Subscribed via provider.on |

See [CIP-103 Conformance](concepts/cip-103-conformance/) for the per-method conformance table.

## Architecture

\`\`\`
dApp UI
  -> window.canton (CIP-103 provider; EIP-1193 object shape)
  -> JSON-RPC (CIP-103 OpenRPC schema + Zod validation)
  -> WindowTransport (postMessage)
  -> Wallet extension (RPC server)
  -> Canton Ledger API / DAML
\`\`\`

## React usage

\`\`\`tsx
import { CantonReactProvider, useConnect, useAccounts } from "@sigilry/react";

function App() {
  const { connect, isPending } = useConnect();
  const { data: accounts, isConnected } = useAccounts();

  if (!isConnected) return <button onClick={connect}>Connect</button>;
  return <div>Connected: {accounts[0]?.hint}</div>;
}
\`\`\`

## Documentation

- [Getting Started](getting-started/introduction/): Overview and quick start guide
- [Architecture](concepts/architecture/): How the pieces fit together
- [CIP-103 Conformance](concepts/cip-103-conformance/): Per-method conformance status, deviations, versioning
- [Transports](concepts/transports/): WindowTransport, HTTP, WebSocket
- [RPC Protocol](concepts/rpc-protocol/): JSON-RPC and Zod validation
- [@sigilry/dapp](packages/dapp/): CIP-103 provider and RPC client
- [@sigilry/react](packages/react/): React hooks and context
- [@sigilry/cli](packages/cli/): TypeScript codegen from DAML
- [@sigilry/splice-dars](packages/splice-dars/): Vendored Splice DAR files
- [API Reference](api-reference/readme/): Full TypeScript API documentation
`,
          contentNegotiation: true,
        }),
        starlightTypeDoc({
          entryPoints: [
            "../packages/dapp/src/index.ts",
            "../packages/react/src/index.ts",
            "../packages/cli/src/index.ts",
            "../packages/splice-dars/src/index.ts",
          ],
          tsconfig: "../tsconfig.json",
          output: "api-reference",
          sidebar: {
            label: "API Reference",
            collapsed: true,
          },
          typeDoc: {
            publicPath: undefined, // Use relative links for versioned base path compatibility
            plugin: ["typedoc-plugin-frontmatter", "./scripts/typedoc-slug-plugin.mjs"],
          },
        }),
      ],
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/sigilry/sigilry" }],
      sidebar: [
        {
          label: "Getting Started",
          items: [
            { label: "Introduction", slug: "getting-started/introduction" },
            { label: "Quick Start", slug: "getting-started/quick-start" },
            { label: "Demo App", slug: "getting-started/demo-app" },
          ],
        },
        {
          label: "Packages",
          items: [
            { label: "@sigilry/dapp", slug: "packages/dapp" },
            { label: "@sigilry/react", slug: "packages/react" },
            { label: "@sigilry/cli", slug: "packages/cli" },
            { label: "@sigilry/splice-dars", slug: "packages/splice-dars" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "Architecture", slug: "concepts/architecture" },
            { label: "CIP-103 Conformance", slug: "concepts/cip-103-conformance" },
            { label: "Transports", slug: "concepts/transports" },
            { label: "RPC Protocol", slug: "concepts/rpc-protocol" },
          ],
        },
        {
          label: "Migrations",
          items: [
            { label: "Overview & release cadence", slug: "migrations" },
            { label: "1.x → 2.0", slug: "migrations/v1-to-v2" },
          ],
        },
        typeDocSidebarGroup,
      ],
      components: {
        Footer: "./src/components/Footer.astro",
      },
      customCss: ["./src/styles/custom.css"],
      editLink: {
        baseUrl: "https://github.com/sigilry/sigilry/edit/main/docs/",
      },
    }),
  ],
});
