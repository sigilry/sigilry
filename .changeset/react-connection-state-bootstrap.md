---
"@sigilry/react": minor
---

Add the `initGraceMs` bootstrap grace-window option to `CantonReactProvider` and the additive `useCanton().onAccountsChanged` subscription so consumers can prefer push-driven connection state updates without breaking existing integrations. Both changes are backwards-compatible: the new prop keeps a safe default and the new subscription method is optional.
