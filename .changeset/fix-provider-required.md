---
"@sigilry/dapp": patch
---

Fix Provider schema `required` list to reference the renamed `providerType` field (was `clientType` after the CIP-0103 rename), so strict JSON Schema validators and downstream codegen treat `providerType` as required rather than optional.
