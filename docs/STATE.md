# Project State

This file is the durable handoff for future sessions.

## Current Stage

Monorepo foundation implemented.

Application code has started. The repository now contains a pnpm workspace with API, Web, CLI, shared contracts, and core engine skeleton packages.

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

Before generating application code, confirm:

1. The full product direction is correct.
2. Documentation should remain English-only.
3. The implementation should start from the monorepo foundation.
4. The first executable product slice should be:

```text
Web UI upload -> API run -> source extraction -> analysis -> documentation tree -> Markdown download
```

## Next Implementation Step

Implement Phase 5: Documentation Generation.

Required packages:

```text
packages/ai-orchestrator
packages/documentation-generator
```

The next step should add AI provider abstractions, prompt contracts in code, documentation plan generation, deterministic fallback page generation where possible, schema validation, and `DocumentationTree` output.

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

## Open Questions

- Should the Web UI be Next.js or Vite React? Decision for initial implementation: Vite React.
- Should the API run jobs in-process first or use BullMQ from the start? Decision for initial implementation: in-process.
- Which OpenAI-compatible provider/model should be configured first?
- What default upload limits should be used?
- Should generated output be stored only temporarily or persisted between server restarts?
