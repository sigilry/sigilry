# Sigilry Specs Index

This directory contains technical specs and design docs. Use this index to track spec scope and implementation readiness.

## Spec TOC

### Root and Index

- `../SPEC.md` — top-level spec entrypoint and global TOC
- `README.md` — this file

### Repo-Level Specs

- `ci-cd.spec.md` — CI/CD pipeline spec

### Package/App Sub-Specs

- `../packages/dapp/SPEC.md`
- `../packages/dapp/discovery.spec.md` — provider discovery + push-event channel
- `../packages/react/SPEC.md`
- `../packages/cli/SPEC.md`
- `../packages/canton-json-api/SPEC.md`
- `../packages/splice-dars/SPEC.md`
- `../examples/demo-app/SPEC.md`
- `../docs/docs-app.spec.md`

## Active Specs

- `ci-cd.spec.md` — CI/CD pipeline spec

## Spec Statuses

| Spec                                 | Status      | Notes                                                              |
| ------------------------------------ | ----------- | ------------------------------------------------------------------ |
| `ci-cd.spec.md`                      | Draft       | CI/CD pipeline spec                                                |
| `../packages/dapp/discovery.spec.md` | Implemented | Shipped in `@sigilry/dapp@3.1.0` (discovery subpath + push events) |
