# Sigilry Spec Index

This is the top-level specification entrypoint for the monorepo.

## Spec TOC

### Repo-Level Specs

- `SPEC.md` (this file)
- `specs/README.md` (spec index and SRP status)
- `specs/relay-protocol.spec.md`
- `specs/ci-cd.spec.md`
- `specs/srp-sdk.spec.md`
- `specs/srp-crypto.spec.md`
- `specs/srp-permissions.spec.md`
- `specs/srp-relay-service.spec.md`
- `specs/srp-wallet-ui.spec.md`
- `specs/srp-cli.spec.md`
- `specs/srp-webrtc.spec.md`

### Package Sub-Specs

- `packages/dapp/SPEC.md`
- `packages/react/SPEC.md`
- `packages/cli/SPEC.md`
- `packages/canton-json-api/SPEC.md`
- `packages/splice-dars/SPEC.md`

### App Sub-Specs

- `examples/demo-app/SPEC.md`
- `docs/docs-app.spec.md`

## Documentation Site Spec (moved from `docs/SPEC.md`)

## Overview

Documentation site for Sigilry - chain-agnostic dApp infrastructure for building wallet connections.

## Goals

- Enable dApp developers to integrate Sigilry packages quickly
- Provide AI agents with structured, parseable content for code generation and troubleshooting
- Document architecture decisions to help evaluate fit for projects

## Target Audience

| Audience          | Priority  | Needs                                             |
| ----------------- | --------- | ------------------------------------------------- |
| dApp developers   | Primary   | Quick start, API reference, usage patterns        |
| AI agents         | Primary   | Structured content, llms.txt, copy-paste examples |
| Wallet developers | Secondary | Architecture docs, extension points               |

## Technology

- **Framework**: Astro Starlight (v0.37.3+)
- **Hosting**: Cloudflare Workers (`sigilry.org`)
- **Build**: Integrated with monorepo via Turbo

## Content Structure

```text
docs/src/content/docs/
├── index.mdx
├── getting-started/
│   ├── introduction.mdx
│   └── quick-start.mdx
├── packages/
│   ├── dapp.mdx
│   ├── react.mdx
│   └── cli.mdx
├── concepts/
│   ├── architecture.mdx
│   ├── transports.mdx
│   └── rpc-protocol.mdx
└── api/
    ├── dapp/
    ├── react/
    └── cli/
```

## Agent Optimization

### llms.txt

Minimal `llms.txt` at site root with balanced coverage:

- Project summary and package overview
- Key API contracts and method signatures
- Architecture diagram (text-based)
- Common usage patterns with code snippets
- Links to detailed docs sections

### Content Guidelines

- Use semantic headings (one H1 per page)
- Include code blocks with language tags
- Prefer inline code over prose for API names
- Structure pages with clear sections: Overview, Usage, API, Examples
- Keep examples self-contained and copy-paste ready

## API Reference Generation

Auto-generate from dual sources:

1. **TypeScript**: TSDoc comments via TypeDoc or similar
2. **OpenRPC specs**: From `specs/` directory

Combine into unified API reference pages per package.

## Versioning

Tag-based versioning from initial release:

| Path     | Source        | Description         |
| -------- | ------------- | ------------------- |
| `/`      | `main` branch | Latest/current docs |
| `/v0.1/` | `v0.1.x` tags | Version 0.1 docs    |
| `/v0.2/` | `v0.2.x` tags | Version 0.2 docs    |

**CI workflow:**

1. Push to `main` -> deploy to root path
2. Push tag `v*` -> build from tag, deploy to `/v{major}.{minor}/`
3. Version dropdown in nav links all deployed versions

## Hosting

- **Platform**: Cloudflare Workers with Static Assets
- **Domain**: `sigilry.org`
- **Deploy trigger**: GitHub Actions on push to main

## Success Criteria

- [ ] dApp developer can go from zero to working connection in less than 10 minutes
- [ ] AI agent can generate correct Sigilry integration code from docs alone
- [ ] All three packages documented with usage examples
- [ ] llms.txt validates via llms-txt checker
- [ ] Versioned docs deploy correctly on tag push

## Out of Scope (initial release)

- i18n / translations
- Interactive code playground
- Video tutorials
- Community/discussion features
