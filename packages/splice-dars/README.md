# @sigilry/splice-dars

Vendored [Splice](https://github.com/hyperledger-labs/splice) DAR files with typed path exports.

## Install

```bash
npm install @sigilry/splice-dars
# or
yarn add @sigilry/splice-dars
```

## Usage

```typescript
import { spliceDars, allSpliceDars, SPLICE_VERSION } from "@sigilry/splice-dars";

// Individual DAR paths
console.log(spliceDars.amulet); // resolved path to splice-amulet-*.dar
console.log(spliceDars.apiTokenHolding); // resolved path to splice-api-token-holding-*.dar

// All DAR paths as an array
for (const dar of allSpliceDars) {
  console.log(dar);
}

// Which Splice release these DARs came from
console.log(SPLICE_VERSION); // "0.5.14"
```

### Available DARs

| Export Key                      | DAR                                        |
| ------------------------------- | ------------------------------------------ |
| `amulet`                        | splice-amulet                              |
| `util`                          | splice-util                                |
| `apiFeaturedApp`                | splice-api-featured-app-v1                 |
| `apiTokenAllocationInstruction` | splice-api-token-allocation-instruction-v1 |
| `apiTokenAllocationRequest`     | splice-api-token-allocation-request-v1     |
| `apiTokenAllocation`            | splice-api-token-allocation-v1             |
| `apiTokenBurnMint`              | splice-api-token-burn-mint-v1              |
| `apiTokenHolding`               | splice-api-token-holding-v1                |
| `apiTokenMetadata`              | splice-api-token-metadata-v1               |
| `apiTokenTransferInstruction`   | splice-api-token-transfer-instruction-v1   |
| `utilBatchedMarkers`            | splice-util-batched-markers                |
| `utilTokenStandardWallet`       | splice-util-token-standard-wallet          |

## Version Compatibility

This package follows standard semver via changesets. The `SPLICE_VERSION` export indicates which Splice release the bundled DARs came from.

| Package Version | Splice Version |
| --------------- | -------------- |
| 0.3.x           | 0.5.4          |
| 0.4.0           | 0.5.14         |

## Source and Licensing

The bundled DAR files are extracted from the public Splice release tarball.

- Upstream project: `hyperledger-labs/splice`
- Source release channel: `digital-asset/decentralized-canton-sync`
- Bundled DAR artifacts: redistributed under Apache License 2.0
- Package wrapper code and metadata: MIT

See [`NOTICE`](./NOTICE) for provenance and [`LICENSE`](./LICENSE) for the full license texts.
