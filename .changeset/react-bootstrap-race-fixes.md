---
"@sigilry/react": patch
---

Fix bootstrap connection-state races so accountsChanged events remain authoritative during in-flight status restore and malformed grace-window account payloads report exactly one error.
