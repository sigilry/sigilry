# sigilry

[![CI](https://github.com/sigilry/sigilry/actions/workflows/ci.yml/badge.svg)](https://github.com/sigilry/sigilry/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm @sigilry/dapp](https://img.shields.io/npm/v/@sigilry/dapp.svg?label=@sigilry/dapp)](https://www.npmjs.com/package/@sigilry/dapp)
[![npm @sigilry/react](https://img.shields.io/npm/v/@sigilry/react.svg?label=@sigilry/react)](https://www.npmjs.com/package/@sigilry/react)
[![npm @sigilry/splice-dars](https://img.shields.io/npm/v/@sigilry/splice-dars.svg?label=@sigilry/splice-dars)](https://www.npmjs.com/package/@sigilry/splice-dars)

[CIP-103](https://github.com/canton-foundation/cips/blob/main/cip-0103/cip-0103.md)-compliant dApp connectivity for Canton Network. Built and maintained by [Send](https://send.it); used in production by Send's dApps.

## Packages

| Package                                                | Description                                                             |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| [@sigilry/dapp](./packages/dapp)                       | SpliceProvider interface, RPC client/server, transports, discovery      |
| [@sigilry/react](./packages/react)                     | React context, hooks, connection state                                  |
| [@sigilry/cli](./packages/cli)                         | TypeScript code generation from DAML DARs (dpm alpha generator wrapper) |
| [@sigilry/canton-json-api](./packages/canton-json-api) | Generated Canton JSON API v2 types and Zod schemas                      |
| [@sigilry/splice-dars](./packages/splice-dars)         | Vendored Splice DAR files with typed path exports                       |

## SDK Ownership

Sigilry owns dApp RPC schemas, provider/transports, discovery, React state/hooks, the DAR alpha-generator wrapper, and generated JSON Ledger API types/schema. Each package's README/SPEC and manifest document its contract and version. Consumer repositories record the versions they adopt and verify their installed APIs.

[canton-clients](https://github.com/0xsend/canton-clients/blob/main/README.md) owns Canton/Splice protocol clients, transport-neutral Daml metadata, LF metadata codegen, typed gRPC/JSON Daml actions, signing/topology helpers, and upstream provenance. Its [LF metadata generator](https://github.com/0xsend/canton-clients/blob/main/packages/lf-meta-codegen/README.md) differs from Sigilry's DAR wrapper; its JSON client differs from Sigilry's types/schema-only package. Switching these contracts is an explicit migration. Send Connect wallet approvals, credential storage, signing authorization, and gateway orchestration belong to canton-monorepo.

## Specifications

- [Top-level Spec TOC](./SPEC.md)
- [Specs Directory Index](./specs/README.md)

## Architecture

```
SpliceProvider interface                       <- dApp-facing API (window.canton, discovery)
    |
RPC (client/server, Zod validation)            <- CIP-103 OpenRPC schemas
    |
Transport (WindowTransport,                    <- pluggable via RpcTransport
           WalletConnectTransport)
    |
Wallet RPC server (createCantonServer)         <- wallet implements handlers
```

`@sigilry/dapp` ships `WindowTransport` (`postMessage`) and `WalletConnectTransport`. Other channels such as HTTP or WebSocket are supported by implementing the `RpcTransport` interface yourself; see [Transports](https://sigilry.org/concepts/transports/).

## Installation

Install the stable **3.x** line of `@sigilry/dapp` and `@sigilry/react` for Canton Network / CIP-0103 integrations:

```bash
yarn add @sigilry/dapp@^3 @sigilry/react@^3
# Or with npm
npm install @sigilry/dapp@^3 @sigilry/react@^3
```

Both packages publish 3.x on `latest`. The `next` tag is frozen on the old 2.0 prerelease line; use 3.x with the current Send Connect extension. See the [migration guides](https://sigilry.org/migrations/) when upgrading from 1.x or 2.x. The CLI, JSON API types, and DAR packages have their own version lines.

## Partner guides

- [Connect to Send Connect testnet](https://sigilry.org/guides/send-connect-testnet/) — extension installation, network selection, and wallet URLs.
- [Verify signMessage](https://sigilry.org/guides/verify-sign-message/) — the Send Connect extension's hex DER format, WebCrypto verification with the active account key, and delegated-key limits. Send source implements hex DER and signer metadata for extension and WalletConnect message signing; deployed behavior requires the supported wallet/release contract. Wallet pages, extensions, and SDKs deploy independently; signature-only responses remain supported.
- [Read holdings](https://sigilry.org/guides/read-holdings/) — query token holdings through `ledgerApi`; submit commands with `prepareExecute`.

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
yarn check
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
