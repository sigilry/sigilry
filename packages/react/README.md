# @sigilry/react

React hooks and context for Canton Network / CIP-0103 wallet connections, built on `@sigilry/dapp` and React Query.

## Install

```bash
yarn add @sigilry/react@^3 @sigilry/dapp@^3 @tanstack/react-query
```

The stable dapp/react SDK line is 3.x on `latest`. The `next` tag is frozen on an older prerelease. React 18 or later is required. See the [migration guides](https://sigilry.org/migrations/) when upgrading from 1.x or 2.x.

## Usage

Wrap the application with `QueryClientProvider` and `CantonReactProvider`, then use hooks such as `useConnect`, `useAccounts`, and `useSignMessage`. The [package guide](https://sigilry.org/packages/react/) includes provider setup, wallet discovery, and hook examples.

Partner guides: [Send Connect testnet](https://sigilry.org/guides/send-connect-testnet/), [verify signMessage](https://sigilry.org/guides/verify-sign-message/), and [read holdings](https://sigilry.org/guides/read-holdings/).
