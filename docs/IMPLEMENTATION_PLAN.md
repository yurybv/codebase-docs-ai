# Implementation Plan

This plan describes how to generate the full product, not a reduced MVP.

## Goal

Build a working documentation module that accepts one or more source archives, analyzes them safely, generates structured documentation, and exposes the workflow through API, Web UI, SDK, and CLI.

## Phase 1: Monorepo Foundation

Deliverables:

- pnpm workspace;
- TypeScript base config;
- lint/format/test setup;
- package layout;
- shared type package;
- basic build scripts.

Packages/apps:

```text
apps/api
apps/web
apps/cli
packages/shared
packages/core
```

Done when:

- `pnpm install` works;
- `pnpm build` works;
- `pnpm test` works;
- shared types compile.

## Phase 2: Source Loading And Security

Deliverables:

- archive upload/extraction library;
- local folder loader for CLI/internal usage;
- file inventory;
- path traversal protection;
- file size/count limits;
- ignore/denylist rules;
- secret redaction.

Packages:

```text
packages/source-loader
packages/security
```

Done when:

- safe archive fixtures load;
- malicious traversal fixtures are rejected;
- denied files are skipped;
- fake secrets are redacted;
- tests cover core safety behavior.

## Phase 3: Per-Source Analyzer

Deliverables:

- package manager detection;
- framework detection;
- script extraction;
- dependency extraction;
- Next.js route detection;
- NestJS controller detection;
- API client detection;
- env var detection;
- CI/Docker/database file detection;
- `RepositoryMap` output.

Package:

```text
packages/repo-analyzer
```

Done when:

- fixture frontend produces a useful `RepositoryMap`;
- fixture backend produces a useful `RepositoryMap`;
- unknown source still produces inventory and warnings.

## Phase 4: System Analyzer

Deliverables:

- multi-source correlation;
- frontend/backend API matching;
- environment links;
- auth flow evidence extraction;
- shared type/package relationship detection;
- `SystemMap` output.

Package:

```text
packages/system-analyzer
```

Done when:

- frontend fixture API calls can be matched to backend fixture routes;
- unmatched calls/routes are reported;
- system warnings are generated with confidence.

## Phase 5: Documentation Generation

Deliverables:

- documentation plan generator;
- AI provider abstraction;
- OpenAI-compatible adapter;
- prompt contracts;
- schema validation;
- page generators;
- `DocumentationTree`.

Packages:

```text
packages/ai-orchestrator
packages/documentation-generator
```

Done when:

- engine can generate all default pages;
- output includes source references;
- output includes warnings/unknowns;
- AI output is schema-validated.

## Phase 6: Renderers

Deliverables:

- markdown tree renderer;
- single markdown renderer;
- JSON renderer;
- zip packaging for downloads.

Package:

```text
packages/renderers
```

Done when:

- documentation tree can be downloaded as markdown zip;
- single markdown output is stable;
- JSON output matches contract.

## Phase 7: API

Deliverables:

- NestJS API;
- run lifecycle endpoints;
- multipart upload;
- temporary run storage;
- result retrieval;
- download endpoint;
- safe error handling.

App:

```text
apps/api
```

Done when:

- external clients can create a run;
- upload archives;
- start generation;
- poll status;
- fetch result;
- download markdown.

## Phase 8: Web UI

Deliverables:

- upload screen;
- source role selectors;
- run progress view;
- generated page preview;
- warnings panel;
- download controls.

App:

```text
apps/web
```

Done when:

- user can upload frontend/backend archives;
- user can generate documentation;
- user can preview pages;
- user can download output.

## Phase 9: SDK

Deliverables:

- HTTP client;
- typed request/response models;
- upload helper;
- run polling helper;
- result download helper.

Package:

```text
packages/sdk
```

Done when:

- Node.js project can call the API through SDK;
- SDK examples are documented;
- SDK is not required for non-Node integrations.

## Phase 10: CLI

Deliverables:

- local generation command;
- archive/folder source options;
- output format options;
- API mode option later if needed.

App:

```text
apps/cli
```

Done when:

- local archives can generate docs from terminal;
- CLI uses the same engine contracts.

## Phase 11: Shared Engine Orchestration

Deliverables:

- shared `DocumentationEngine` orchestration in `packages/core`;
- API uses the shared engine after source loading;
- CLI uses the shared engine after local source resolution;
- duplicated analyzer/generator/renderer orchestration is removed from adapters.

Done when:

- API lifecycle tests still pass;
- CLI smoke generation still passes;
- API and CLI depend on the same core generation method.

## Phase 12: AI Provider Integration

Deliverables:

- OpenAI-compatible provider adapter;
- environment-based provider configuration;
- optional AI-assisted documentation page generation;
- deterministic fallback when no provider is configured;
- schema validation for AI page output.

Done when:

- local generation works without credentials;
- AI provider behavior is covered by mocked tests;
- documentation generator validates AI page output before rendering;
- API and CLI can use the provider when credentials are configured.

## Phase 17: Documentation Quality Expansion

Deliverables:

- deterministic content for system architecture;
- frontend route/script/API call documentation;
- backend endpoint/script/runtime documentation;
- auth evidence documentation;
- local development command documentation;
- testing command documentation;
- build/deployment evidence documentation;
- external integration evidence documentation.

Done when:

- default documentation pages no longer rely on generic placeholders for core product sections;
- deterministic output remains useful without AI credentials;
- generator tests cover the specialized sections.

## Phase 18: Analyzer Evidence Expansion

Deliverables:

- broader framework detection;
- more deployment/test config detection;
- better API client method detection for `fetch`;
- broader auth dependency evidence;
- broader external integration dependency evidence;
- prefix matching for scoped integration packages.

Done when:

- repository analyzer tests cover new framework/config/fetch method evidence;
- system analyzer tests cover scoped auth and integration dependencies;
- generated documentation receives richer evidence without API contract changes.

## Cross-Cutting Work

During all phases:

- update docs;
- update `docs/STATE.md`;
- add tests with each package;
- avoid committing generated private artifacts;
- keep package boundaries clean.
