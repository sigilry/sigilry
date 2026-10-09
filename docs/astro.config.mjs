import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import sitemap from "@astrojs/sitemap";
import starlightLlmsTxt from "@0xbigboss/starlight-llms-txt";
import starlightLinksValidator from "starlight-links-validator";
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
      description:
        "Canton Network dApp SDK for CIP-0103 wallet connections, with TypeScript providers, React hooks, and Send Connect integration guides.",
      logo: {
        light: "./src/assets/logo-lockup-dark.svg",
        dark: "./src/assets/logo-lockup-light.svg",
        alt: "Sigilry",
        replacesTitle: true,
      },
      favicon: "/favicon.svg",
      head: [
        // PNG fallback for browsers without SVG favicons; the sizes hint keeps the SVG preferred.
        { tag: "link", attrs: { rel: "icon", href: `${base}favicon.png`, sizes: "32x32" } },
      ],
      disable404Route: true,
      expressiveCode: {
        themes: ["vitesse-dark", "vitesse-light"],
        styleOverrides: {
          borderRadius: "8px",
          codeFontFamily: "'JetBrains Mono', ui-monospace, monospace",
        },
      },
      plugins: [
        starlightLinksValidator({ errorOnRelativeLinks: false }),
        starlightLlmsTxt({
          details: `Sigilry is a [CIP-103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)-compliant dApp connectivity library for Canton Network. CIP-103 is the approved Canton standard for dApp ↔ wallet JSON-RPC. Sigilry implements the CIP-103 dApp API as typed TypeScript clients and servers, ships Zod schemas generated from the CIP-103 OpenRPC spec, and exposes React Query hooks.

Packages:

- **@sigilry/dapp** (3.x): CIP-103 provider interface (\`SpliceProvider\`), RPC client/server, message schemas, provider discovery, and the \`WindowTransport\` and \`WalletConnectTransport\` transports.
- **@sigilry/react** (3.x): \`CantonReactProvider\` and React Query hooks such as \`useConnect\`, \`useAccounts\`, \`useLedgerApi\`, and \`useDiscovery\`.
- **@sigilry/canton-json-api** (1.x): Canton JSON Ledger API v2 types and Zod schemas for \`ledgerApi\` bodies.
- **@sigilry/cli**: TypeScript codegen from DAML DARs.
- **@sigilry/splice-dars**: Vendored Splice DAR files with typed path exports.

Integration notes:

- Wallet extensions inject the provider at \`window.canton\`. Import \`@sigilry/dapp/browser-globals\` to type it; it is optional because no wallet may be installed.
- Code samples on package, guide, and concept pages are compiled against the current packages in CI. Migration guides show historical APIs on purpose.
- Each page is available as Markdown by appending \`.md\` to its URL or by requesting it with \`Accept: text/markdown\`.
- The per-method CIP-103 surface, including push events, is in [CIP-103 Conformance](concepts/cip-103-conformance/). Full signatures are in the [API Reference](api-reference/readme/).
`,
          contentNegotiation: true,
          promote: ["index*", "getting-started/**", "guides/**", "packages/**"],
          demote: ["migrations/**", "api-reference/**"],
        }),
        starlightTypeDoc({
          entryPoints: [
            "../packages/dapp/src/index.ts",
            "../packages/dapp/src/discovery/index.ts",
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
            // starlight-typedoc deletes nested `README.md` pages (its match is case-sensitive),
            // which leaves the root index linking to missing module pages. Lowercase keeps
            // them and preserves the existing `/readme/` URLs.
            entryFileName: "readme",
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
            { label: "Choosing a Canton dApp SDK", slug: "compare/canton-dapp-sdks" },
          ],
        },
        {
          label: "Partner Guides",
          items: [
            { label: "Send Connect Testnet", slug: "guides/send-connect-testnet" },
            { label: "Verify signMessage", slug: "guides/verify-sign-message" },
            { label: "Read Holdings", slug: "guides/read-holdings" },
          ],
        },
        {
          label: "Packages",
          items: [
            { label: "@sigilry/dapp", slug: "packages/dapp" },
            { label: "@sigilry/react", slug: "packages/react" },
            { label: "@sigilry/cli", slug: "packages/cli" },
            { label: "@sigilry/splice-dars", slug: "packages/splice-dars" },
            { label: "@sigilry/canton-json-api", slug: "packages/canton-json-api" },
          ],
        },
        {
          label: "Concepts",
          items: [
            { label: "Architecture", slug: "concepts/architecture" },
            { label: "CIP-103 Conformance", slug: "concepts/cip-103-conformance" },
            { label: "Provider Discovery", slug: "concepts/discovery" },
            { label: "Transports", slug: "concepts/transports" },
            { label: "RPC Protocol", slug: "concepts/rpc-protocol" },
          ],
        },
        {
          label: "Migrations",
          items: [
            { label: "Overview & release cadence", slug: "migrations" },
            { label: "1.x → 2.0", slug: "migrations/v1-to-v2" },
            { label: "2.x → 3.0", slug: "migrations/v2-to-v3" },
          ],
        },
        typeDocSidebarGroup,
      ],
      components: {
        Footer: "./src/components/Footer.astro",
      },
      customCss: [
        "@fontsource-variable/dm-sans",
        "@fontsource-variable/jetbrains-mono",
        "./src/styles/custom.css",
      ],
      routeMiddleware: "./src/routeData.ts",
      editLink: {
        baseUrl: "https://github.com/sigilry/sigilry/edit/main/docs/",
      },
    }),
  ],
});
