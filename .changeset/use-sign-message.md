---
"@sigilry/react": minor
---

Add `useSignMessage`, a react-query mutation hook for the `signMessage` wallet RPC. The hook returns `{ signMessage, signMessageAsync, isPending, isError, error, data, reset }` mirroring `useExerciseChoice` / `useSubmitCommand`. Additive only; no existing public exports change.
