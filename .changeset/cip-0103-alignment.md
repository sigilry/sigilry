---
"@sigilry/dapp": major
---

Align with CIP-0103: nested StatusEvent, ConnectResult, isConnected method, v2 ledgerApi, SpliceTarget routing, WindowTransport target.

Migration notes:

- `@sigilry/react` `ExerciseChoiceRequest` now uses `choice` instead of `choiceName` to match the Canton Ledger API `ExerciseCommand` wire field.
