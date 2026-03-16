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
          details: `## Packages

- **@sigilry/dapp**: Core provider interface, RPC client/server, message schemas, transports (Window, HTTP, WS)
- **@sigilry/react**: React Query hooks (useConnect, useAccounts, useSession) and CantonReactProvider
- **@sigilry/cli**: TypeScript codegen from DAML DARs

## Quick Integration

\`\`\`ts
async function connect() {
  const status = await window.canton.request({ method: "status" });
  if (!status.isConnected) {
    await window.canton.request({ method: "connect" });
  }
  return await window.canton.request({ method: "listAccounts" });
}
\`\`\`

## Key RPC Methods

| Method | Description |
|--------|-------------|
| status | Get connection state |
| connect | Initiate wallet connection |
| disconnect | End wallet session |
| listAccounts | Get user's account addresses |

## Architecture

\`\`\`
dApp UI
  -> window.canton (EIP-1193 style provider)
  -> JSON-RPC (OpenRPC + Zod validation)
  -> WindowTransport (postMessage)
  -> Wallet extension (RPC server)
  -> Canton Ledger API / DAML
\`\`\`

## React Usage

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
- [Transports](concepts/transports/): WindowTransport, HTTP, WebSocket
- [RPC Protocol](concepts/rpc-protocol/): JSON-RPC and Zod validation
- [@sigilry/dapp](packages/dapp/): Core provider and RPC client
- [@sigilry/react](packages/react/): React hooks and context
- [@sigilry/cli](packages/cli/): TypeScript codegen from DAML
- [API Reference](api-reference/readme/): Full TypeScript API documentation
`,
          contentNegotiation: true,
        }),
        starlightTypeDoc({
          entryPoints: [
            "../packages/dapp/src/index.ts",
            "../packages/react/src/index.ts",
            "../packages/cli/src/index.ts",
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
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "Architecture", slug: "concepts/architecture" },
            { label: "Transports", slug: "concepts/transports" },
            { label: "RPC Protocol", slug: "concepts/rpc-protocol" },
          ],
        },
        typeDocSidebarGroup,
      ],
      customCss: ["./src/styles/custom.css"],
      editLink: {
        baseUrl: "https://github.com/sigilry/sigilry/edit/main/docs/",
      },
    }),
  ],
});
