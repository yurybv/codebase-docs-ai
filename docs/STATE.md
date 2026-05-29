# Project State

This file is the durable handoff for future sessions.

## Current Stage

Monorepo foundation implemented.

Application code has started. The repository now contains a pnpm workspace with API, Web, CLI, SDK, shared contracts, source loading, security filtering, repository/system analysis, documentation generation, renderers, and executable Web/API/SDK/CLI product surfaces.

## Product Decision Log

### 2026-05-29

- The product is not GitHub-first.
- The product is not Confluence-first.
- Core input is one or more source archives or folders.
- Core output is a structured documentation tree rendered to Markdown/JSON.
- GitHub and Confluence are future adapters, not core dependencies.
- The module must work through API for any external project/language.
- Node.js SDK is useful but not the only integration path.
- Web UI exists primarily for manual testing and operator usage.
- The system must support frontend/backend archives analyzed together.
- Documentation and specification should be written in English.

## Current Source Of Truth

- Product specification: `codebase-docs-ai-project-documentation.md`
- Architecture: `docs/ARCHITECTURE.md`
- API contract: `docs/API_CONTRACT.md`
- Implementation plan: `docs/IMPLEMENTATION_PLAN.md`
- Security: `docs/SECURITY.md`
- Testing: `docs/TESTING.md`
- Prompt contracts: `docs/PROMPT_CONTRACTS.md`
- External source docs: `docs/EXTERNAL_RULE_SOURCES.md`

## Reviewed External Inputs

### project-rule-templates

Useful for:

- AGENTS rules;
- development workflow;
- git workflow;
- security;
- testing;
- code review;
- PR template.

Decision:

- Adapt manually.
- Do not run the script blindly.

### ECC

Useful for:

- plan-first workflow;
- TDD discipline;
- security-first review;
- TypeScript coding style;
- prompt patterns;
- documentation update workflow.

Decision:

- Borrow ideas.
- Do not copy ECC-specific agent/harness content directly.

## Next Required User Approval

None at the moment.

Continue autonomous development until a product, architecture, credential, provider, or deployment decision cannot be made safely from repository context.

## Next Implementation Step

Implement Phase 13: Persistence And Run Artifact Retention.

Required package:

```text
apps/api
packages/shared
```

The next step should replace the API's purely in-memory run store with a small persistence boundary. Start with filesystem-backed run metadata and rendered artifact retention under `.tmp/codebase-docs-ai`, then keep the API contract unchanged.

## Completed Implementation

### 2026-05-29: Phase 1 Monorepo Foundation

- Added pnpm workspace configuration.
- Added TypeScript base config.
- Added ESLint, Prettier, and Vitest setup.
- Added `packages/shared` with source/documentation/run contracts and Zod schemas.
- Added `packages/core` with a minimal `DocumentationEngine` skeleton.
- Added `apps/api` NestJS skeleton with `/health`.
- Added `apps/web` Vite React skeleton.
- Added `apps/cli` Commander skeleton.
- Added initial package tests.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

### 2026-05-29: Phase 2 Source Loader

- Added `packages/source-loader`.
- Added local folder loading.
- Added zip, tar, tar.gz, and tgz extraction support.
- Added path traversal checks before extraction.
- Added source file count, per-file size, and total size limits.
- Added sorted file inventory output.
- Added tests for folder loading, zip extraction, and unsafe path rejection.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

### 2026-05-29: Phase 2 Security Filtering And Redaction

- Added `packages/security`.
- Added denylist filtering for env files, credentials, keys, and secret files.
- Added generated path filtering for `node_modules`, `dist`, `build`, `.next`, coverage, cache, and `.git`.
- Added binary extension filtering.
- Added prompt file size filtering.
- Added secret redaction for private keys, database URLs, OpenAI keys, GitHub tokens, JWTs, and secret-like assignments.
- Added tests for file filtering and secret redaction.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

### 2026-05-29: Phase 3 Repository Analyzer

- Added `packages/repo-analyzer`.
- Added package manager detection.
- Added package script and dependency extraction.
- Added framework detection for Next.js, React, NestJS, Express, Vite, and TypeScript.
- Added Next.js app/pages route detection.
- Added NestJS controller endpoint detection.
- Added frontend API client call detection for `fetch` and `axios`.
- Added environment variable detection for `process.env` and `import.meta.env`.
- Added config file detection for TypeScript, Next, Nest, Docker, GitHub Actions, and Prisma.
- Added repository risk output for missing metadata/readme evidence.
- Added tests for frontend and backend fixture analysis.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

### 2026-05-29: Phase 4 System Analyzer

- Added `packages/system-analyzer`.
- Added `SystemMap` shared contracts.
- Added API contract matching between frontend calls and backend endpoints.
- Added system relationships for matched API calls, shared dependencies, and environment coupling.
- Added environment link detection across repositories.
- Added auth flow evidence from auth-related dependencies.
- Added known integration detection from dependencies.
- Added system risks for unmatched consumer/provider API contracts.
- Added tests for matched and unmatched frontend/backend contracts.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

### 2026-05-29: Phase 5 AI Orchestration And Documentation Generator

- Added `packages/ai-orchestrator`.
- Added AI provider contract and local JSON provider for deterministic tests/future adapters.
- Added `packages/documentation-generator`.
- Added shared documentation plan contracts.
- Added default 14-page documentation plan.
- Added deterministic `DocumentationTree` generation from `SystemMap`.
- Added generated markdown pages for overview, source inventory, API contracts, environment, risks, and source references.
- Added generic placeholder pages for specialized sections that will be expanded later.
- Added tests for documentation planning and tree generation.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

### 2026-05-29: Phase 6 Renderers

- Added `packages/renderers`.
- Added Markdown tree renderer.
- Added single Markdown renderer.
- Added JSON renderer.
- Added zip packaging for rendered documentation files.
- Added shared rendered documentation contracts.
- Added renderer tests.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

### 2026-05-29: Phase 7 API Run Lifecycle

- Added documentation run controller endpoints.
- Added in-memory run lifecycle service with temporary filesystem storage.
- Added multipart source upload handling.
- Added in-process pipeline: source loading, security filtering, repository analysis, system analysis, documentation generation, and rendering.
- Added result retrieval endpoint support.
- Added download handling for markdown tree zip, single markdown, and JSON.
- Added deletion cleanup for temporary run artifacts.
- Added service test covering create, upload, start, result, and download.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

### 2026-05-29: Phase 8 Web UI Upload Flow

- Replaced the placeholder Web UI with an operator workflow.
- Added archive upload control.
- Added source role and source name editing.
- Added API-backed run creation, source upload, run start, result retrieval, and download controls.
- Added generated page list and Markdown preview.
- Added status/error display.
- Added source metadata helper and tests.
- Added browser smoke verification for the local Vite app.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
Browser smoke test at http://localhost:5173/
```

### 2026-05-29: Phase 9 SDK

- Added `packages/sdk`.
- Added typed HTTP client for documentation run lifecycle operations.
- Added create, upload, start, get, result, download, and delete methods.
- Added multipart source upload support.
- Added typed SDK error handling.
- Added SDK tests for create and upload behavior.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

### 2026-05-29: Phase 10 CLI

- Replaced CLI placeholder output with a real local `generate` command.
- Added repeated `--source path:role` support for folders and archives.
- Added `--format` support for `markdown-tree`, `single-markdown`, `json`, and CLI-only `zip`.
- Added local pipeline execution using source loading, security filtering, repository analysis, system analysis, documentation generation, and renderers.
- Added output writing to disk.
- Added structured JSON failure output for CLI errors.
- Added CLI option parsing tests.
- Added README and module integration CLI usage docs.
- Added smoke verification with paired frontend/backend folders and matched `/api/users` contract output.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
CLI smoke generation with local frontend/backend fixtures
```

### 2026-05-29: Phase 11 Shared Engine Orchestration

- Expanded `packages/core` from a run-plan skeleton into the shared documentation orchestration engine.
- Added core generation from loaded sources through security filtering, repository analysis, system analysis, documentation generation, and rendering.
- Updated API run lifecycle to call the shared engine after archive loading.
- Updated CLI generation to call the shared engine after local folder/archive loading.
- Removed analyzer/generator orchestration dependencies from API and CLI adapters.
- Added core engine generation tests.
- Updated architecture and implementation plan docs.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
CLI smoke generation with local frontend/backend fixtures
```

### 2026-05-29: Phase 12 AI Provider Integration And Prompt-Backed Documentation

- Added an OpenAI-compatible AI provider adapter.
- Added environment-based AI provider configuration.
- Required explicit model configuration instead of hardcoding a default model.
- Added optional AI-assisted documentation page generation behind deterministic fallback behavior.
- Added Zod validation for AI-generated documentation pages.
- Wired API and CLI engines to use the provider when credentials and model are configured.
- Added mocked provider tests and AI-backed documentation generator tests.
- Updated prompt contract and README configuration docs.

Verification:

```text
pnpm build
pnpm typecheck
pnpm test
pnpm lint
CLI smoke generation with local frontend/backend fixtures
```

## Open Questions

- Should the Web UI be Next.js or Vite React? Decision for initial implementation: Vite React.
- Should the API run jobs in-process first or use BullMQ from the start? Decision for initial implementation: in-process.
- Which OpenAI-compatible provider/model should be configured first?
- What default upload limits should be used?
- Should generated output be stored only temporarily or persisted between server restarts?
