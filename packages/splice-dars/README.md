# @sigilry/splice-dars

Splice DAR files for @sigilry SDK development.

## Version Compatibility

Current tracked Splice DAR release: **0.5.14**.

| Package Version | Splice Version |
| --------------- | -------------- |
| 0.3.1           | 0.5.4          |
| 0.5.14          | 0.5.14         |

## Usage

```typescript
import { spliceDars, allSpliceDars } from "@sigilry/splice-dars";
```

## Source and Licensing

The bundled DAR files are extracted from the public Splice release tarball for the matching version.

- Upstream project: `hyperledger-labs/splice`
- Source release channel: `digital-asset/decentralized-canton-sync`
- Bundled DAR artifacts: redistributed under Apache License 2.0
- Package wrapper code and metadata: MIT

See [`NOTICE`](./NOTICE) for provenance and [`LICENSE`](./LICENSE) for the full license texts.

## Publishing

This package is versioned independently from other `@sigilry` packages. Update the version manually when upgrading Splice DARs, verify the upstream release provenance, and add a row to the compatibility table above.
