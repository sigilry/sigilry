# sigilry

[![CI](https://github.com/sigilry/sigilry/actions/workflows/ci.yml/badge.svg)](https://github.com/sigilry/sigilry/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm @sigilry/dapp](https://img.shields.io/npm/v/@sigilry/dapp.svg?label=@sigilry/dapp)](https://www.npmjs.com/package/@sigilry/dapp)
[![npm @sigilry/react](https://img.shields.io/npm/v/@sigilry/react.svg?label=@sigilry/react)](https://www.npmjs.com/package/@sigilry/react)
[![npm @sigilry/splice-dars](https://img.shields.io/npm/v/@sigilry/splice-dars.svg?label=@sigilry/splice-dars)](https://www.npmjs.com/package/@sigilry/splice-dars)

[CIP-103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)-compliant dApp connectivity for Canton Network. Built and maintained by [Send](https://send.it); used in production by Send's dApps.

## Packages

| Package                                                | Description                                             |
| ------------------------------------------------------ | ------------------------------------------------------- |
| [@sigilry/dapp](./packages/dapp)                       | SpliceProvider interface, RPC client/server, transports |
| [@sigilry/react](./packages/react)                     | React context, hooks, connection state                  |
| [@sigilry/cli](./packages/cli)                         | OpenRPC to TypeScript codegen                           |
| [@sigilry/canton-json-api](./packages/canton-json-api) | Generated Canton JSON API v2 types and Zod schemas      |
| [@sigilry/splice-dars](./packages/splice-dars)         | Vendored Splice DAR files with typed path exports       |

## Specifications

- [Top-level Spec TOC](./SPEC.md)
- [Specs Directory Index](./specs/README.md)

## Architecture

```
Transport (WindowTransport, HTTP, WS)  <- pluggable
    |
RPC (client/server, Zod validation)    <- chain-agnostic
    |
SpliceProvider interface               <- dApp-facing API
    |
ChainHandler (chain-specific logic)    <- consumers implement
```

## Installation

`@sigilry/dapp` and `@sigilry/react` are on the **`2.0.0-next.N` pre-release line** while the CIP-0103 RPC contract settles. Install with an explicit version or the `next` dist-tag; the `latest` tag still points at the older `1.x` line.

```bash
# Pin to a specific pre-release (recommended)
yarn add @sigilry/dapp@2.0.0-next.3 @sigilry/react@2.0.0-next.3

# Or track the rolling next tag (expect breaks between bumps)
yarn add @sigilry/dapp@next @sigilry/react@next
```

See [`docs/migrations`](./docs/src/content/docs/migrations/) for the full release cadence policy and per-version migration guides.

## Development

Recommended local workflow (ensures tools like `dpm` are available for hooks):

```bash
direnv allow
```

This repo includes a root `.envrc` with:

- `use flake` (loads the Nix dev shell)
- `source_env_if_exists .envrc.private` (optional local env overrides, e.g. docs preview host config)

If you do not use `direnv`, run `nix develop` manually.

```bash
yarn install
yarn build
yarn test
yarn typecheck
```

`yarn build` and `yarn test` exclude the demo app and docs package.

Pre-push verification is enforced via `lefthook` and runs `yarn verify:pre-push`.
Avoid bypassing hooks with `--no-verify`; if checks fail, run and fix:

```bash
yarn verify:pre-push
```

To run the demo app locally:

```bash
yarn --cwd examples/demo-app dev
```

To build the demo app only:

```bash
# Optional if the committed DAR is already up to date
(cd examples/demo-app && dpm build -o dars/demo-todo-package-0.0.1.dar)
yarn --cwd examples/demo-app setup
yarn --cwd examples/demo-app build
```

To run docs locally:

```bash
yarn --cwd docs dev
# Network preview (uses DOCS_ALLOWED_HOSTS, defaults to localhost)
yarn --cwd docs preview:network
```

## Maintainers

Sigilry is built and maintained by [Send](https://send.it). Issues and contributions are accepted on this public mirror; changes flow through the private canonical repository via Copybara.

## License

MIT
