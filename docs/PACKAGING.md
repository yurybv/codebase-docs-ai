# Packaging And Public Boundaries

This document defines how `codebase-docs-ai` is consumed as a reusable module and which repository boundaries are public.

## Runtime Requirement

The repository targets:

```text
Node.js >= 20.10.0
pnpm 9.9.0
```

`pnpm verify` is the canonical full repository check. It runs build, typecheck, unit tests, lint, and the smoke e2e harness.

## Public Product Surfaces

### HTTP API

Primary public integration surface.

Use the HTTP API when:

- the host application is not Node.js;
- the module runs as a standalone service;
- source archives are uploaded from another backend or workflow engine;
- the host owns persistence, authentication, scheduling, and downstream publication.

The API accepts source archives plus metadata and returns a run result with a structured documentation tree and rendered artifacts.

### Node.js SDK

Public TypeScript convenience client.

The SDK wraps the HTTP API and is intended for Node.js or TypeScript hosts that want typed calls instead of manually constructing multipart requests.

The stable SDK entry point is:

```ts
import { CodebaseDocsAIClient } from '@codebase-docs-ai/sdk';
```

The high-level helper is `client.documentationRuns.generateFromArchives(...)`. It creates a run, uploads archives, starts generation, polls completion, retrieves the tree, and optionally downloads a rendered artifact.

### CLI

Public operator and automation surface.

The CLI supports two execution modes:

- local mode, which accepts folders or archives and runs the engine in-process;
- API mode, which accepts archives and delegates generation to a running API service.

The package bin name is:

```text
codebase-docs-ai
```

During monorepo development, run it through the workspace package:

```bash
pnpm --filter @codebase-docs-ai/cli exec tsx src/main.ts generate
```

### Web UI

Public manual testing and operator surface.

The Web UI must stay thin. It owns archive selection, source metadata input, run progress display, preview, and downloads. It must not contain source loading, analysis, generation, or rendering business logic.

## Internal Package Boundaries

The repository keeps implementation packages separate so they can be tested and evolved independently.

### `@codebase-docs-ai/core`

Internal orchestration package reused by API and CLI.

It coordinates source loading, security filtering, repository analysis, system analysis, AI planning, documentation generation, and rendering.

Potential future public use is possible, but the current stable external module boundary remains API first and SDK second.

### `@codebase-docs-ai/shared`

Shared contracts package.

This package contains source, repository, system, documentation, and run contracts. It is the main contract source for API, SDK, CLI, and internal packages.

### Analyzer And Generation Packages

These packages are internal implementation boundaries:

- `@codebase-docs-ai/source-loader`;
- `@codebase-docs-ai/security`;
- `@codebase-docs-ai/repo-analyzer`;
- `@codebase-docs-ai/system-analyzer`;
- `@codebase-docs-ai/ai-orchestrator`;
- `@codebase-docs-ai/documentation-generator`;
- `@codebase-docs-ai/renderers`.

They should not be treated as separate public products yet. Public behavior should be exposed through API, SDK, CLI, and generated documentation outputs.

## Application Packages

These packages are deployable applications and remain private:

- `@codebase-docs-ai/api`;
- `@codebase-docs-ai/web`;
- `@codebase-docs-ai/cli`.

The CLI has a public bin surface, but the package itself remains workspace-private until packaging and distribution are explicitly prepared.

## Publication Status

All packages are currently marked `private: true`.

This is intentional for the current stage:

- the monorepo is still establishing product behavior;
- HTTP API and SDK contracts should stabilize before npm publication;
- package names and release automation should be confirmed before publishing;
- docs output quality and API error shapes should be reviewed before external release.

Future publication can split packages into:

- public SDK package;
- public CLI package;
- private application deployments;
- optionally public core/shared packages after their contracts stabilize.

## Boundary Rules

- External systems should prefer HTTP API unless they are Node.js/TypeScript hosts.
- Node.js/TypeScript hosts may use the SDK for convenience.
- The Web UI must talk to the API and must not import core engine packages.
- API mode CLI must use archive uploads because that is the HTTP boundary.
- Local CLI mode may accept folders because it runs inside a trusted local environment.
- Source adapters such as GitHub, GitLab, S3, Confluence, or Jira must remain outside the core pipeline until explicitly added as adapters.
- Generated documentation is the product output; downstream publishing is host-owned unless an adapter is added later.

## Verification

Run the full check before considering a module-boundary change complete:

```bash
pnpm verify
```
