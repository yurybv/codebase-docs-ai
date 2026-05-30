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
- Default git workflow is direct commits to `master`; do not create feature branches unless explicitly requested.

## Current Source Of Truth

- Product specification: `codebase-docs-ai-project-documentation.md`
- Architecture: `docs/ARCHITECTURE.md`
- API contract: `docs/API_CONTRACT.md`
- Implementation plan: `docs/IMPLEMENTATION_PLAN.md`
- Packaging and public boundaries: `docs/PACKAGING.md`
- Security: `docs/SECURITY.md`
- Testing: `docs/TESTING.md`
- Prompt contracts: `docs/PROMPT_CONTRACTS.md`
- Next continuation prompt: `docs/NEXT_DEVELOPMENT_PROMPT.md`
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

Implement Phase 105: Shared Public Sanitizer Consolidation.

Required package:

```text
packages/shared
packages/documentation-generator
packages/security
packages/source-loader
packages/core
packages/ai-orchestrator
packages/sdk
apps/api
apps/cli
docs
```

The next step should consolidate duplicated public text sanitizer behavior into a shared package helper so API, CLI, SDK, core, AI orchestration, source-loader, and documentation-generator redaction behavior stays consistent.

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

### 2026-05-29: Phase 13 Persistence And Run Artifact Retention

- Replaced API run state storage with filesystem-backed run manifests.
- Persisted uploaded source metadata, lifecycle status, documentation tree, and rendered output artifacts under the run temp directory.
- Updated result and download endpoints to read retained artifacts from disk.
- Kept the external API contract unchanged.
- Added test coverage for reading a completed run through a new service instance.
- Documented temporary artifact retention behavior.

Verification:

```text
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test -- apps/api/src/documentation-runs.service.test.ts
```

### 2026-05-29: Phase 14 API Progress And Error Reporting

- Added shared run progress and run error contracts.
- Persisted progress details on API run manifests.
- Added structured progress labels for each generation step.
- Persisted failed run status and safe error messages when generation throws.
- Updated API docs with progress and failure response examples.
- Added API service tests for completed progress and persisted failure details.

Verification:

```text
pnpm --filter @codebase-docs-ai/shared build
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test -- apps/api/src/documentation-runs.service.test.ts
```

### 2026-05-29: Phase 15 Web Progress And Failure UX

- Updated Web UI run state to include API progress and safe error details.
- Added completed progress display after generation.
- Added failed run detail retrieval from persisted API run state when start fails.
- Added progress bar and compact progress labels to the result panel.
- Improved API error parsing for JSON error bodies.
- Verified Web UI rendering in the browser.

Verification:

```text
pnpm --filter @codebase-docs-ai/web typecheck
pnpm --filter @codebase-docs-ai/web build
Browser smoke test at http://localhost:5173/
```

### 2026-05-29: Phase 16 End-To-End API/Web Integration Test Harness

- Added `pnpm smoke:e2e`.
- Added a Node smoke harness that starts API and Web dev servers.
- Added fixture frontend/backend archive creation.
- Verified HTTP create, upload, start, result, and download lifecycle against the running API.
- Verified Web root reachability with API base URL wiring.
- Added required Nest validation runtime dependencies.
- Fixed source-loader path safety to allow normal directory archive entries with trailing slashes while still blocking unsafe paths.
- Added source-loader coverage for trailing slash directory entries.
- Documented the smoke harness in testing docs.

Verification:

```text
pnpm smoke:e2e
```

### 2026-05-29: Phase 17 Documentation Quality Expansion

- Expanded deterministic documentation beyond generic placeholders.
- Added specialized system architecture content.
- Added frontend documentation for frameworks, scripts, routes, and API calls.
- Added backend documentation for frameworks, scripts, and API endpoints.
- Added authentication evidence documentation.
- Added local development command documentation.
- Added testing command and gap documentation.
- Added build/deployment script and config documentation.
- Added external integration evidence documentation.
- Added generator fixture coverage for the specialized sections.

Verification:

```text
pnpm --filter @codebase-docs-ai/documentation-generator typecheck
pnpm test -- packages/documentation-generator/src/generate-documentation-tree.test.ts
pnpm lint
```

### 2026-05-29: Phase 18 Analyzer Evidence Expansion

- Added broader framework detection for Vue, Angular, Svelte, Nuxt, Remix, and Fastify.
- Added Vite, Playwright, and Cypress config detection.
- Improved `fetch` API client detection to read explicit `method` options.
- Expanded auth evidence detection for Auth.js, Clerk, Auth0, Firebase auth, Supabase auth, JWT, and Passport dependencies.
- Expanded integration detection for scoped Stripe, AWS SDK, OpenAI, SendGrid, Twilio, Redis, BullMQ, Kafka, Firebase, Supabase, and related packages.
- Added prefix matching for scoped dependency families such as `@aws-sdk/*` and `@clerk/*`.
- Added repository and system analyzer test coverage for richer evidence.

Verification:

```text
pnpm --filter @codebase-docs-ai/repo-analyzer typecheck
pnpm --filter @codebase-docs-ai/system-analyzer typecheck
pnpm test -- packages/repo-analyzer/src/analyze-repository.test.ts packages/system-analyzer/src/analyze-system.test.ts
pnpm lint
```

### 2026-05-29: Phase 19 SDK Polling And High-Level Generate Helper

- Added SDK polling for documentation run completion.
- Added failed/cancelled/expired run handling with persisted run error messages.
- Added `generateFromArchives` helper for create, upload, start, poll, result, and optional download flow.
- Improved SDK API error parsing for JSON error bodies.
- Added SDK tests for high-level generation and failed polling.
- Documented SDK integration usage.

Verification:

```text
pnpm --filter @codebase-docs-ai/sdk typecheck
pnpm test -- packages/sdk/src/client.test.ts
pnpm lint
```

### 2026-05-29: Phase 20 CLI API Mode

- Added CLI `--api-url` option.
- Added SDK-backed API mode for remote documentation generation.
- Kept local mode available for folder and archive inputs.
- Added downloaded artifact writing for API mode.
- Documented CLI API mode in README and module integration docs.
- Expanded `pnpm smoke:e2e` to verify CLI API mode against a running API server.

Verification:

```text
pnpm --filter @codebase-docs-ai/cli typecheck
pnpm test -- apps/cli/src/cli-options.test.ts
pnpm lint
pnpm smoke:e2e
```

### 2026-05-29: Phase 21 API Retention Cleanup

- Added configurable API run retention via `DOCS_AI_RUN_RETENTION_MS`.
- Added filesystem cleanup method for expired run manifests and artifacts.
- Kept public HTTP API behavior unchanged.
- Added API service test coverage for deleting expired run directories.
- Documented temporary artifact retention and cleanup configuration.

Verification:

```text
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test -- apps/api/src/documentation-runs.service.test.ts
pnpm lint
```

### 2026-05-29: Phase 22 API Upload Limits And Request Hardening

- Added configurable multipart upload limits.
- Added defaults for maximum uploaded files and per-file upload size.
- Added a Multer exception filter that returns safe 400 responses for invalid uploads.
- Applied upload limits to source archive upload endpoint.
- Added upload limit parsing tests.
- Documented API upload limit environment variables.

Verification:

```text
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test -- apps/api/src/upload-limits.test.ts apps/api/src/documentation-runs.service.test.ts
pnpm lint
```

### 2026-05-29: Phase 23 Web Upload Limit Guidance

- Added Web upload constraint parsing.
- Added client-side file count and file size validation.
- Added concise upload limit label to the archive dropzone.
- Added clean failed-state messages for too many or oversized selected files.
- Added upload constraint unit tests.

Verification:

```text
pnpm --filter @codebase-docs-ai/web typecheck
pnpm test -- apps/web/src/upload-constraints.test.ts apps/web/src/source-metadata.test.ts
pnpm lint
```

### 2026-05-29: Phase 24 Operational Configuration Documentation

- Added operator-facing runtime documentation.
- Documented local commands and verification flow.
- Documented API, Web, CLI, SDK, AI provider, upload limit, and retention environment variables.
- Documented CLI local mode and API mode usage.
- Documented smoke harness behavior.
- Added operations document to README index.

Verification:

```text
docs-only change
```

### 2026-05-29: Phase 25 Packaging And Public API Boundaries Review

- Added the canonical `pnpm verify` repository check.
- Declared the supported Node.js runtime floor.
- Documented public product surfaces for HTTP API, SDK, CLI, and Web UI.
- Documented internal package boundaries for core, shared contracts, analyzers, generation, rendering, and deployable apps.
- Clarified that all packages remain private until release and publication decisions are made.
- Added packaging and public boundary documentation to the README index.

Verification:

```text
pnpm verify
```

### 2026-05-29: Phase 26 API Contract Response Shape Alignment

- Added a global API exception filter that wraps HTTP and unhandled exceptions in the public `{ error: ... }` envelope.
- Aligned multipart upload limit failures with the same error envelope.
- Added shared API error payload contracts.
- Extended the SDK error class to preserve API `code` and `details` fields.
- Documented the stable API error response shape and SDK error accessors.
- Added focused API and SDK tests for error response normalization and parsing.

Verification:

```text
pnpm verify
```

### 2026-05-29: Phase 27 Release And Deployment Packaging

- Added Docker service packaging with separate API and Web targets.
- Added Docker Compose for local external-module operation.
- Added Docker ignore rules for leaner build context.
- Configured Web preview to bind to container-friendly host and port settings.
- Documented API/Web deployment shape, runtime variables, compose usage, and production notes.
- Added deployment documentation to README and operations references.

Verification:

```text
docker compose config
pnpm verify
```

### 2026-05-29: Phase 28 Documentation Quality Golden Fixture Review

- Added a representative frontend/backend quality fixture for the full documentation engine.
- Verified generated documentation includes overview, system architecture, API contracts, frontend routes, backend endpoints, environment variables, tests, deployment evidence, integrations, auth evidence, and rendered artifacts.
- Documented the quality fixture as the minimum output bar for analyzer, system mapping, generation, and renderer changes.

Verification:

```text
pnpm verify
```

### 2026-05-29: Phase 29 Docker Image Build Verification

- Verified the API Docker target builds successfully.
- Verified the Web Docker target builds successfully with `VITE_WEB_API_BASE_URL`.
- Added package scripts for API image build, Web image build, and compose config validation.
- Updated deployment and operations docs to use the repeatable Docker scripts.

Verification:

```text
docker build --target api -t codebase-docs-ai-api:local .
docker build --target web --build-arg VITE_WEB_API_BASE_URL=http://localhost:3000 -t codebase-docs-ai-web:local .
pnpm verify
```

### 2026-05-29: Phase 30 API Lifecycle Integration Tests

- Extracted shared Nest app bootstrap configuration for runtime and tests.
- Added an HTTP-level API lifecycle test that boots the real Nest app on an ephemeral port.
- Verified create, upload, start, result, download, delete, and not-found behavior through public HTTP calls.
- Verified standardized API error envelopes for invalid requests.
- Documented the API lifecycle test in the testing guide.

Verification:

```text
pnpm verify
```

### 2026-05-29: Phase 31 Docker Runtime Smoke Test

- Added a Docker runtime smoke script that starts API and Web through Compose.
- Verified API `/health` and Web root reachability from running containers.
- Ensured the smoke script tears down containers and volumes after the check.
- Added a `pnpm docker:smoke` script and documented when to use it.

Verification:

```text
pnpm docker:smoke
pnpm verify
```

### 2026-05-29: Phase 32 API Security And Abuse Limits Review

- Added run status guards for source uploads and generation starts.
- Blocked source upload after a run has started or completed.
- Blocked repeated start calls after completion.
- Cleared old upload, extraction, and result artifacts when replacing sources in the ready state.
- Documented lifecycle misuse controls in the security guide.
- Added API service tests for lifecycle misuse and ready-state upload replacement cleanup.

Verification:

```text
pnpm verify
```

### 2026-05-29: Phase 33 API Rate Limit Adapter Planning

- Documented why the module should not hardcode a user model for rate limiting.
- Defined gateway, reverse proxy, and host-owned quota responsibilities.
- Documented future built-in rate limit adapter options and required identity decisions.
- Linked rate limiting guidance from README, operations, and security docs.

Verification:

```text
docs-only change
```

### 2026-05-29: Phase 34 AI Provider Configuration Validation

- Added fail-fast validation for partial OpenAI-compatible provider configuration.
- Required key and model whenever any AI provider environment variable is present.
- Validated provider base URL protocol and temperature range.
- Added tests for partial and invalid provider configuration.
- Documented AI provider startup failure behavior in operations, deployment, and prompt contracts.

Verification:

```text
pnpm verify
```

### 2026-05-29: Phase 35 CLI Error Handling And Exit Codes

- Added typed CLI errors with stable error codes and exit codes.
- Added structured CLI failure JSON for user, API, and unexpected errors.
- Validated API mode URLs before execution.
- Classified common source, output, and rendering failures.
- Documented CLI failure output and exit code semantics.
- Added CLI tests for API URL validation and failure formatting.

Verification:

```text
pnpm verify
```

### 2026-05-29: Phase 36 SDK Package Contract Documentation

- Added public SDK contract documentation for external TypeScript consumers.
- Documented runtime expectations for `fetch`, `FormData`, `Blob`, and Node.js `>=20.10.0`.
- Documented archive file input expectations for Node.js and browser hosts.
- Documented each `documentationRuns` method and the high-level archive generation helper.
- Documented `CodebaseDocsAIClientError` handling and versioning boundaries.
- Added an SDK package README and linked SDK contract docs from README, module integration, and packaging docs.

Verification:

```text
pnpm lint
```

### 2026-05-29: Phase 37 SDK Contract Tests For Public Error Shapes

- Added SDK test coverage for multipart upload metadata and generated file fields.
- Added SDK delete method coverage.
- Added SDK polling timeout coverage.
- Added defensive coverage for legacy flat API error shapes.
- Kept public API error envelope preservation covered through `CodebaseDocsAIClientError`.

Verification:

```text
pnpm verify
```

### 2026-05-29: Phase 38 SDK Consumer Examples

- Added SDK examples for Node.js archive upload and Markdown download persistence.
- Added a browser `File` upload example.
- Added a custom polling and download example.
- Added a `CodebaseDocsAIClientError` handling example.
- Linked SDK examples from the SDK contract documentation.

Verification:

```text
pnpm lint
```

### 2026-05-29: Phase 39 Web API Error Envelope Handling

- Added Web API error parsing for the standardized `{ error: ... }` envelope.
- Preserved defensive parsing for legacy flat error bodies and non-JSON responses.
- Included API error codes in operator-facing Web messages.
- Added Web unit tests for API error parsing and formatting.

Verification:

```text
pnpm verify
```

### 2026-05-29: Phase 40 Web API Error UI Smoke Coverage

- Exported the Web `App` component for direct UI tests.
- Guarded root mounting so tests can import the app without a production root node.
- Added a jsdom Web UI test for failed generation with a standardized API error envelope.
- Verified the UI presents the API error code and message to the operator.

Verification:

```text
pnpm verify
```

### 2026-05-29: Phase 41 Web UI Accessibility And Interaction Review

- Added live status semantics for documentation run updates.
- Added alert semantics for persisted run error details.
- Added accessible labels for archive upload and download controls.
- Added progress value text for screen-reader context.
- Disabled the generate action while a run is already creating, uploading, or running.
- Added Web UI tests for accessible status and upload controls.

Verification:

```text
pnpm verify
browser check at http://localhost:5173
```

### 2026-05-29: Phase 42 Web Responsive Browser Verification

- Verified the Web UI at desktop viewport `1440x900`.
- Verified the Web UI at mobile viewport `390x844`.
- Confirmed initial upload, generate, and status surfaces render without obvious first-viewport overlap.
- Added Web QA documentation for responsive and accessibility checks.
- Linked Web QA documentation from the README index.

Verification:

```text
browser check at http://localhost:5173
pnpm lint
```

### 2026-05-29: Phase 43 Web Completed-State Browser Verification

- Verified successful Web generation against the real local API and Web dev servers.
- Uploaded frontend and backend tar archives through the browser flow.
- Assigned source roles through the source row selectors.
- Verified completed progress, generated page navigation, Markdown preview updates, and download controls.
- Verified JSON download starts from the API and returns `documentation-tree.json`.
- Checked completed state at desktop viewport `1440x900`.
- Checked completed state at mobile viewport `390x844`.
- Recorded completed-state Web QA findings.

Verification:

```text
browser check at http://localhost:5173 with API at http://localhost:3300
pnpm lint
```

### 2026-05-29: Phase 44 API Run Retention Scheduler

- Wired expired documentation run cleanup into the Nest module lifecycle.
- Added startup cleanup followed by a configurable interval scheduler.
- Added `DOCS_AI_RUN_CLEANUP_INTERVAL_MS` with `0` as the host-owned cleanup disable switch.
- Cleared the scheduler interval on module shutdown.
- Kept cleanup failures non-fatal and logged them for operators.
- Added service tests for startup cleanup, interval cleanup, disabled scheduling, and shutdown cleanup.
- Documented cleanup interval configuration in operations and deployment docs.

Verification:

```text
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test apps/api/src/documentation-runs.service.test.ts
pnpm verify
```

### 2026-05-29: Phase 45 Web Completed-State Regression Coverage

- Added automated Web completed-state regression coverage.
- Covered multi-archive upload through the Web file input.
- Covered frontend/backend role selection before generation.
- Verified upload metadata sent to the API-shaped contract.
- Verified completed progress rendering, generated page navigation, Markdown preview switching, and JSON download URL generation.
- Added a standalone `pnpm web:completed-state` command.
- Documented the completed-state regression in Web QA and testing docs.

Verification:

```text
pnpm web:completed-state
pnpm --filter @codebase-docs-ai/web typecheck
```

### 2026-05-29: Phase 46 Web Generated Warnings Display

- Rendered generated documentation warnings in the completed Web state.
- Added a labeled warning region above generated page navigation.
- Displayed warning level and message without requiring JSON output inspection.
- Kept warnings separate from fatal run errors.
- Extended completed-state Web regression coverage to include generated warning display.
- Documented expected warning behavior in Web QA docs.

Verification:

```text
pnpm web:completed-state
pnpm --filter @codebase-docs-ai/web typecheck
```

### 2026-05-29: Phase 47 Web Output Format Selection

- Added Web output format checkboxes for markdown tree, single Markdown, and JSON.
- Sent only selected output formats in the create-run API request.
- Blocked generation with a clear status message when no output format is selected.
- Kept completed download controls aligned to the formats rendered for that run.
- Extended Web completed-state regression coverage for format selection and selected-format downloads.
- Documented output format selection behavior in Web QA and testing docs.

Verification:

```text
pnpm --filter @codebase-docs-ai/web typecheck
pnpm web:completed-state
```

### 2026-05-29: Phase 48 Web Output Format Browser Verification

- Verified the running Web app at `http://localhost:5173/`.
- Confirmed all output formats are selected by default.
- Confirmed the running UI can be toggled down to JSON-only selection.
- Checked desktop and mobile first-viewport layout after adding format controls.
- Fixed narrow mobile heading clipping by tightening mobile heading sizing and constraining the topbar text container.
- Recorded browser QA findings in `docs/WEB_QA.md`.

Verification:

```text
Browser check at http://localhost:5173/
```

### 2026-05-29: Phase 49 Download Format Availability Contract

- Added `renderedFormats` to completed run state.
- Returned `renderedFormats` from the documentation result endpoint.
- Persisted rendered format availability with run artifacts.
- Kept SDK result types aligned with the API response.
- Added API service, HTTP lifecycle, and SDK regression coverage.
- Documented how API and SDK consumers can discover downloadable formats.

Verification:

```text
pnpm --filter @codebase-docs-ai/shared build
pnpm --filter @codebase-docs-ai/api typecheck
pnpm --filter @codebase-docs-ai/sdk typecheck
pnpm test -- apps/api/src/documentation-runs.service.test.ts apps/api/src/documentation-runs.http.test.ts packages/sdk/src/client.test.ts
```

### 2026-05-29: Phase 50 Web Download Controls From API Rendered Formats

- Updated the Web completed state to prefer API-provided `renderedFormats`.
- Kept selected output formats as the pre-generation request state.
- Preserved fallback to selected formats for older API responses without `renderedFormats`.
- Added Web regression coverage for API-rendered download controls when the API returns a narrower format list.
- Documented the completed-state behavior in Web QA and testing docs.

Verification:

```text
pnpm --filter @codebase-docs-ai/web typecheck
pnpm web:completed-state
```

### 2026-05-29: Phase 51 Web Rendered Format Browser Verification

- Ran the Web app against a mock API that returned a narrower `renderedFormats` list than the pre-run selection.
- Uploaded a synthetic archive through the browser file input.
- Confirmed the completed status and Markdown preview rendered.
- Confirmed completed download controls used the API-rendered format list and displayed only `single-markdown`.
- Recorded browser QA findings in `docs/WEB_QA.md`.

Verification:

```text
Browser check at http://localhost:5173/ with mock API at http://127.0.0.1:3000
```

### 2026-05-29: Phase 52 API Source Archive Type Validation

- Added API upload-boundary validation for supported archive file names.
- Supported `.zip`, `.tar`, `.tar.gz`, and `.tgz` uploads.
- Rejected unsupported archive file names with a safe `SOURCE_ARCHIVE_UNSUPPORTED_TYPE` error before storing upload artifacts.
- Fixed the upload route exception filter so non-Multer upload-route errors use the same public API error envelope.
- Added API service and HTTP lifecycle coverage for unsupported upload rejection.
- Documented supported archive upload types in the API contract.

Verification:

```text
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test -- apps/api/src/documentation-runs.service.test.ts apps/api/src/documentation-runs.http.test.ts apps/api/src/api-exception.filter.test.ts
```

### 2026-05-29: Phase 53 Web Supported Archive Guidance Alignment

- Aligned the Web upload file input accept list with API-supported archive types.
- Added visible upload guidance for `.zip`, `.tar`, `.tar.gz`, and `.tgz`.
- Added Web regression coverage for the file input accept list and visible archive guidance.
- Verified the running Web app displays the updated guidance.

Verification:

```text
pnpm --filter @codebase-docs-ai/web typecheck
pnpm web:completed-state
Browser check at http://localhost:5173/
```

### 2026-05-29: Phase 54 Web Client-Side Archive Type Validation

- Added client-side validation for selected Web upload file names.
- Rejected unsupported selected files before creating source rows or uploading to the API.
- Kept Web supported archive checks aligned with `.zip`, `.tar`, `.tar.gz`, and `.tgz`.
- Added unit and UI regression coverage for unsupported file selection.
- Verified the unsupported-file path in a browser with a synthetic `notes.txt` selection.

Verification:

```text
pnpm --filter @codebase-docs-ai/web typecheck
pnpm test -- apps/web/src/upload-constraints.test.ts apps/web/src/main.test.ts
Browser check at http://localhost:5173/
```

### 2026-05-29: Phase 55 Shared Archive Type Contract

- Added a shared source archive contract for supported extensions, accept strings, labels, detection, and extension stripping.
- Updated source-loader archive extraction, API upload validation, Web upload guidance/validation, Web source-name inference, and CLI source-name inference to depend on the shared contract.
- Added shared contract tests for supported extension publication, case-insensitive detection, matched extension lookup, and extension stripping.
- Added the shared package as a Web dependency so browser-facing upload behavior uses the same contract as API and package code.
- Updated the API contract error example to include `.tgz`.

Verification:

```text
pnpm --filter @codebase-docs-ai/shared build
pnpm --filter @codebase-docs-ai/source-loader typecheck
pnpm --filter @codebase-docs-ai/api typecheck
pnpm --filter @codebase-docs-ai/web typecheck
pnpm --filter @codebase-docs-ai/cli typecheck
pnpm test -- packages/shared/src/source-archive-contract.test.ts apps/web/src/upload-constraints.test.ts apps/web/src/source-metadata.test.ts apps/cli/src/cli-options.test.ts apps/api/src/documentation-runs.service.test.ts apps/api/src/documentation-runs.http.test.ts
```

### 2026-05-29: Phase 56 SDK Archive Type Validation

- Added SDK client-side source archive filename validation using the shared archive contract.
- Rejected unsupported `uploadSources` inputs before constructing multipart form data or sending network requests.
- Rejected unsupported `generateFromArchives` inputs before creating a documentation run.
- Documented supported SDK archive filenames and client-side preflight error behavior.

Verification:

```text
pnpm --filter @codebase-docs-ai/sdk typecheck
pnpm test -- packages/sdk/src/client.test.ts
```

### 2026-05-29: Phase 57 CLI API Mode Archive Type Validation

- Added CLI API mode preflight validation for supported source archive filenames using the shared archive contract.
- Rejected unsupported API mode source files with `CLI_API_SOURCE_ARCHIVE_UNSUPPORTED` before SDK/API upload work.
- Kept local mode folder and archive handling unchanged.
- Documented CLI API mode supported archive filenames in README, module integration, and operations docs.

Verification:

```text
pnpm --filter @codebase-docs-ai/cli typecheck
pnpm test -- apps/cli/src/generate-command.test.ts apps/cli/src/cli-options.test.ts
```

### 2026-05-29: Phase 58 Source Loader Tar Archive Regression Coverage

- Added direct source-loader extraction coverage for `.tar`, `.tar.gz`, and `.tgz` archives.
- Kept existing zip extraction coverage intact.
- Used synthetic fixture archives only; no private source or uploaded artifacts were committed.

Verification:

```text
pnpm --filter @codebase-docs-ai/source-loader typecheck
pnpm test -- packages/source-loader/src/load-source.test.ts
```

### 2026-05-29: Phase 59 Source Loader Unsupported Archive Regression Coverage

- Added source-loader regression coverage for unsupported archive filenames.
- Rejected unsupported archive filenames with `UnsupportedArchiveError` before creating extraction directories.
- Kept supported zip, tar, tar.gz, and tgz extraction coverage intact.

Verification:

```text
pnpm --filter @codebase-docs-ai/source-loader typecheck
pnpm test -- packages/source-loader/src/load-source.test.ts
```

### 2026-05-29: Phase 60 Source Loader Archive Limit Regression Coverage

- Added source-loader regression coverage for archive file count limits.
- Added source-loader regression coverage for archive per-file size limits.
- Added source-loader regression coverage for archive total size limits.
- Kept supported and unsupported archive format coverage intact.

Verification:

```text
pnpm --filter @codebase-docs-ai/source-loader typecheck
pnpm test -- packages/source-loader/src/load-source.test.ts
```

### 2026-05-29: Phase 61 Source Loader Folder Limit Regression Coverage

- Added source-loader regression coverage for folder file count limits.
- Added source-loader regression coverage for folder per-file size skip behavior.
- Added source-loader regression coverage for folder total size limits.
- Kept archive limit coverage intact.

Verification:

```text
pnpm --filter @codebase-docs-ai/source-loader typecheck
pnpm test -- packages/source-loader/src/load-source.test.ts
```

### 2026-05-29: Phase 62 Source Loader Archive Link Regression Coverage

- Added source-loader regression coverage for tar symbolic link rejection.
- Added source-loader regression coverage for tar hard link rejection.
- Added source-loader regression coverage for zip symbolic link rejection.
- Kept path traversal, folder limit, and archive limit coverage intact.

Verification:

```text
pnpm --filter @codebase-docs-ai/source-loader typecheck
pnpm test -- packages/source-loader/src/load-source.test.ts
```

### 2026-05-29: Phase 63 Source Loader Non-Regular Folder File Regression Coverage

- Added source-loader regression coverage for symbolic links in folder inputs.
- Verified folder symlinks are skipped with `not_regular_file` reporting.
- Kept archive link rejection and folder limit coverage intact.

Verification:

```text
pnpm --filter @codebase-docs-ai/source-loader typecheck
pnpm test -- packages/source-loader/src/load-source.test.ts
```

### 2026-05-29: Phase 64 Security Nested Archive Filter Regression Coverage

- Added security filter regression coverage for nested `.zip`, `.tar`, `.tar.gz`, and `.tgz` source archives.
- Added `.tgz` to the default binary extension filter so all supported source archive formats are excluded from prompt/source context when nested inside inputs.
- Kept existing source-loader archive and folder safety coverage intact.

Verification:

```text
pnpm --filter @codebase-docs-ai/security typecheck
pnpm test -- packages/security/src/file-filter.test.ts
```

### 2026-05-29: Phase 65 Security Prompt File Size Regression Coverage

- Added security filter regression coverage for files above `maxPromptFileSizeBytes`.
- Verified oversized prompt files are skipped with `file_size_limit_exceeded`.
- Kept nested archive filtering coverage intact.

Verification:

```text
pnpm --filter @codebase-docs-ai/security typecheck
pnpm test -- packages/security/src/file-filter.test.ts
```

### 2026-05-29: Phase 66 Security Denylist Key File Regression Coverage

- Added security filter regression coverage for private key filenames.
- Added security filter regression coverage for `.pem`, `.key`, `.p12`, and `.pfx` sensitive files.
- Added security filter regression coverage for credentials and secrets path patterns.
- Kept prompt file size and nested archive filtering coverage intact.

Verification:

```text
pnpm --filter @codebase-docs-ai/security typecheck
pnpm test -- packages/security/src/file-filter.test.ts
```

### 2026-05-29: Phase 67 Secret Redaction Assignment Regression Coverage

- Added secret redaction regression coverage for common password, token, secret, and private key assignment names.
- Verified assignment redaction is case-insensitive and preserves assignment syntax.
- Verified assignment redaction counts remain meaningful.

Verification:

```text
pnpm --filter @codebase-docs-ai/security typecheck
pnpm test -- packages/security/src/redact-secrets.test.ts
```

### 2026-05-29: Phase 68 Secret Redaction Provider Token Regression Coverage

- Added secret redaction regression coverage for OpenAI API keys.
- Added secret redaction regression coverage for GitHub tokens and JWTs.
- Added secret redaction regression coverage for database URLs.
- Kept assignment redaction coverage intact.

Verification:

```text
pnpm --filter @codebase-docs-ai/security typecheck
pnpm test -- packages/security/src/redact-secrets.test.ts
```

### 2026-05-29: Phase 69 AI Prompt Sanitization Regression Coverage

- Added a repository analyzer text-reader hook so core can provide sanitized source text.
- Updated the core engine to read source text through `redactSecrets` after security filtering.
- Added core regression coverage proving denied `.env` content is excluded and raw provider keys are redacted before repository maps reach documentation generation.

Verification:

```text
pnpm --filter @codebase-docs-ai/core typecheck
pnpm test -- packages/core/src/documentation-engine.test.ts
```

### 2026-05-29: Phase 70 Repository Analyzer Reader Injection Regression Coverage

- Added repository-analyzer regression coverage for injected text readers.
- Verified package metadata, NestJS endpoints, API client calls, and environment variables use injected source text instead of raw disk contents.
- Confirmed package-level analyzer consumers can provide sanitized content without leaking raw source evidence into `RepositoryMap`.

Verification:

```text
pnpm --filter @codebase-docs-ai/repo-analyzer typecheck
pnpm test -- packages/repo-analyzer/src/analyze-repository.test.ts
```

### 2026-05-29: Phase 71 Documentation Output Sanitization Regression Coverage

- Extended core sanitization regression coverage to include generated `DocumentationTree` output.
- Verified rendered markdown-tree, single-markdown, and JSON artifacts contain redacted source evidence instead of raw provider keys.
- Verified denied `.env` evidence and raw denied-source variable names do not appear in generated documentation output.

Verification:

```text
pnpm --filter @codebase-docs-ai/core typecheck
pnpm test -- packages/core/src/documentation-engine.test.ts
```

### 2026-05-29: Phase 72 AI Provider Prompt Payload Sanitization Regression Coverage

- Added core regression coverage for AI-provider prompt payloads.
- Captured all local AI provider inputs during documentation generation.
- Verified AI prompts include redacted source evidence and exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/core typecheck
pnpm test -- packages/core/src/documentation-engine.test.ts
```

### 2026-05-29: Phase 73 API Run Sanitization Regression Coverage

- Added HTTP lifecycle regression coverage for uploaded source archives containing a fake provider key and denied `.env` file.
- Verified `/result` payloads expose redacted evidence instead of raw source secrets.
- Verified downloaded single-Markdown artifacts exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test -- apps/api/src/documentation-runs.http.test.ts
```

### 2026-05-29: Phase 74 CLI Generation Sanitization Regression Coverage

- Added CLI local-mode regression coverage for secret-bearing source folders.
- Verified CLI-written single-Markdown output contains redacted source evidence instead of raw provider keys.
- Verified denied `.env` evidence and denied-source variable names are absent from CLI output artifacts.

Verification:

```text
pnpm --filter @codebase-docs-ai/cli typecheck
pnpm test -- apps/cli/src/generate-command.test.ts
```

### 2026-05-29: Phase 75 CLI Zip Output Sanitization Regression Coverage

- Added CLI local-mode regression coverage for packaged Markdown zip output.
- Added direct CLI test dependencies for reading generated zip artifacts.
- Verified files inside CLI-written `documentation.zip` contain redacted source evidence and exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/cli typecheck
pnpm test -- apps/cli/src/generate-command.test.ts
```

### 2026-05-29: Phase 76 CLI JSON Output Sanitization Regression Coverage

- Added CLI local-mode regression coverage for JSON output.
- Verified CLI-written `documentation-tree.json` contains redacted source evidence instead of raw provider keys.
- Verified denied `.env` evidence and denied-source variable names are absent from CLI JSON artifacts.

Verification:

```text
pnpm --filter @codebase-docs-ai/cli typecheck
pnpm test -- apps/cli/src/generate-command.test.ts
```

### 2026-05-29: Phase 77 SDK Download Sanitization Regression Coverage

- Added SDK high-level archive generation regression coverage for sanitized downloaded artifacts.
- Verified SDK-returned documentation payloads preserve redacted API evidence.
- Verified SDK-returned download blobs exclude raw provider keys and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/sdk typecheck
pnpm test -- packages/sdk/src/client.test.ts
```

### 2026-05-29: Phase 78 SDK Result Tree Sanitization Regression Coverage

- Added SDK direct `getResult` regression coverage for sanitized documentation trees.
- Verified SDK-returned `DocumentationTree` payloads preserve redacted API evidence.
- Verified direct SDK result retrieval excludes raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/sdk typecheck
pnpm test -- packages/sdk/src/client.test.ts
```

### 2026-05-29: Phase 79 Web Result Sanitization Regression Coverage

- Added Web completed-state regression coverage for sanitized API result payloads.
- Verified the generated Markdown preview renders redacted source evidence.
- Verified warning/result UI excludes raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/web typecheck
pnpm test -- apps/web/src/main.test.ts
```

### 2026-05-29: Phase 80 Web Download Sanitization Boundary Coverage

- Extended Web completed-state sanitization coverage to click the generated download control.
- Verified completed-state download URLs target the API artifact route with only run id and format.
- Verified browser-visible download URLs exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/web typecheck
pnpm test -- apps/web/src/main.test.ts
```

### 2026-05-29: Phase 81 API JSON Download Sanitization Regression Coverage

- Extended API HTTP sanitization coverage to download the rendered JSON artifact.
- Verified downloaded `documentation-tree.json` contains redacted source evidence instead of raw provider keys.
- Verified downloaded JSON artifacts exclude denied `.env` evidence and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test -- apps/api/src/documentation-runs.http.test.ts
```

### 2026-05-29: Phase 82 API Markdown Tree Zip Sanitization Regression Coverage

- Extended API HTTP sanitization coverage to download the rendered markdown-tree zip artifact.
- Verified files inside downloaded markdown-tree zips contain redacted source evidence instead of raw provider keys.
- Verified downloaded zip artifacts exclude denied `.env` evidence and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test -- apps/api/src/documentation-runs.http.test.ts
```

### 2026-05-29: Phase 83 SDK Markdown Tree Zip Download Sanitization Regression Coverage

- Added SDK direct download regression coverage for markdown-tree zip artifacts.
- Added direct SDK test dependencies for reading generated zip blobs.
- Verified files inside SDK-returned markdown-tree zip blobs contain redacted source evidence and exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/sdk typecheck
pnpm test -- packages/sdk/src/client.test.ts
```

### 2026-05-29: Phase 84 Renderer Zip Sanitization Regression Coverage

- Added renderer regression coverage for zip packaging of sanitized Markdown tree output.
- Verified renderer-produced zip files preserve redacted source evidence.
- Verified renderer-produced zip files exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/renderers typecheck
pnpm test -- packages/renderers/src/renderers.test.ts
```

### 2026-05-29: Phase 85 Renderer JSON Sanitization Regression Coverage

- Added renderer regression coverage for JSON rendering of sanitized documentation trees.
- Verified renderer-produced JSON files preserve redacted source evidence.
- Verified renderer-produced JSON files exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/renderers typecheck
pnpm test -- packages/renderers/src/renderers.test.ts
```

### 2026-05-29: Phase 86 Renderer Single Markdown Sanitization Regression Coverage

- Added renderer regression coverage for single-Markdown rendering of sanitized documentation trees.
- Verified renderer-produced single-Markdown files preserve redacted source evidence.
- Verified renderer-produced single-Markdown files exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/renderers typecheck
pnpm test -- packages/renderers/src/renderers.test.ts
```

### 2026-05-29: Phase 87 Renderer Markdown Tree Sanitization Regression Coverage

- Added renderer regression coverage for markdown-tree rendering of sanitized documentation trees.
- Verified renderer-produced markdown-tree files preserve redacted source evidence.
- Verified renderer-produced markdown-tree files exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/renderers typecheck
pnpm test -- packages/renderers/src/renderers.test.ts
```

### 2026-05-29: Phase 88 SDK JSON Download Sanitization Regression Coverage

- Added SDK direct download regression coverage for sanitized JSON artifacts.
- Verified SDK-downloaded JSON artifacts preserve redacted source evidence.
- Verified SDK-downloaded JSON artifacts exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/sdk typecheck
pnpm test -- packages/sdk/src/client.test.ts
```

### 2026-05-29: Phase 89 SDK Single Markdown Direct Download Sanitization Regression Coverage

- Added SDK direct download regression coverage for sanitized single-Markdown artifacts.
- Verified SDK-downloaded single-Markdown artifacts preserve redacted source evidence.
- Verified SDK-downloaded single-Markdown artifacts exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/sdk typecheck
pnpm test -- packages/sdk/src/client.test.ts
```

### 2026-05-29: Phase 90 CLI Markdown Tree Output Sanitization Regression Coverage

- Added CLI regression coverage for local markdown-tree output from secret-bearing source inputs.
- Verified CLI-written markdown-tree files preserve redacted source evidence.
- Verified CLI-written markdown-tree files exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/cli typecheck
pnpm test -- apps/cli/src/generate-command.test.ts
```

### 2026-05-29: Phase 91 CLI API Mode Download Sanitization Regression Coverage

- Added CLI API-mode regression coverage for sanitized downloaded artifacts.
- Verified CLI-written API-mode download artifacts preserve redacted source evidence.
- Verified CLI-written API-mode download artifacts exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/cli typecheck
pnpm test -- apps/cli/src/generate-command.test.ts
```

### 2026-05-29: Phase 92 API Run Failure Error Sanitization Regression Coverage

- Changed failed documentation runs to persist the documented generic failure summary instead of raw exception messages.
- Added API service regression coverage for internal failures containing a fake provider key and denied `.env` evidence.
- Verified API-visible failed run state excludes raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test -- apps/api/src/documentation-runs.service.test.ts
```

### 2026-05-29: Phase 93 API Error Envelope Secret Sanitization Regression Coverage

- Added recursive sanitization for public API error envelope messages, details, and suggestions.
- Added API exception filter regression coverage for raw provider keys and denied `.env` evidence in structured HTTP exceptions.
- Verified public API error envelopes preserve redaction markers while excluding raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/api typecheck
pnpm test -- apps/api/src/api-exception.filter.test.ts
```

### 2026-05-29: Phase 94 Web API Error Display Sanitization Regression Coverage

- Added Web regression coverage for rendered API error states from sanitized error envelopes.
- Verified operator-facing Web error messages preserve redacted source evidence.
- Verified rendered Web error states exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/web typecheck
pnpm test -- apps/web/src/main.test.ts
```

### 2026-05-29: Phase 95 SDK API Error Message Sanitization Regression Coverage

- Added SDK-side sanitization for API error messages and nested details before throwing client errors.
- Added SDK regression coverage for raw provider keys and denied `.env` evidence in API error envelopes.
- Verified SDK-thrown API errors preserve redaction markers while excluding raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/sdk typecheck
pnpm test -- packages/sdk/src/client.test.ts
```

### 2026-05-29: Phase 96 CLI API Error Output Sanitization Regression Coverage

- Added CLI failure formatting sanitization for SDK/API-mode error messages and nested details.
- Added CLI regression coverage for raw provider keys and denied `.env` evidence in API-mode failure payloads.
- Verified CLI API-mode error output preserves redaction markers while excluding raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/cli typecheck
pnpm test -- apps/cli/src/cli-options.test.ts
```

### 2026-05-29: Phase 97 Source Loader Extraction Error Sanitization Regression Coverage

- Added source-loader error sanitization for unsafe archive paths, unsupported archive paths, and source limit messages.
- Added source-loader regression coverage for unsafe archive entry paths containing a fake provider key and denied `.env` evidence.
- Verified source-loader extraction errors preserve redaction markers while excluding raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/source-loader typecheck
pnpm test -- packages/source-loader/src/load-source.test.ts
```

### 2026-05-30: Phase 98 Core Engine Error Propagation Sanitization Regression Coverage

- Added core-level sanitization for lower-layer generation errors propagated by `DocumentationEngine`.
- Added core regression coverage for AI provider failures containing a fake provider key and denied `.env` evidence.
- Verified core-thrown generation errors preserve redaction markers while excluding raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/core typecheck
pnpm test -- packages/core/src/documentation-engine.test.ts
```

### 2026-05-30: Phase 99 AI Orchestrator Provider Error Sanitization Regression Coverage

- Added AI provider sanitization for OpenAI-compatible transport and response parsing errors.
- Added AI orchestrator regression coverage for provider transport failures containing a fake provider key and denied `.env` evidence.
- Verified AI provider errors preserve redaction markers while excluding raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/ai-orchestrator typecheck
pnpm test -- packages/ai-orchestrator/src/openai-compatible-provider.test.ts
```

### 2026-05-30: Phase 100 Documentation Generator AI Error Sanitization Regression Coverage

- Added documentation-generator regression coverage for AI page validation failures with secret-bearing invalid output.
- Verified validation errors remain generic and do not include raw invalid AI output values.
- Verified documentation-generator AI validation errors exclude raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/documentation-generator typecheck
pnpm test -- packages/documentation-generator/src/generate-documentation-tree.test.ts
pnpm verify
```

### 2026-05-30: Phase 101 Documentation Generator AI Output Sanitization Regression Coverage

- Added sanitization for accepted AI page markdown, warnings, and source references before building the documentation tree.
- Added documentation-generator regression coverage for accepted AI output containing a fake provider key and denied `.env` evidence.
- Verified accepted AI page output preserves redaction markers while excluding raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/documentation-generator typecheck
pnpm test -- packages/documentation-generator/src/generate-documentation-tree.test.ts
```

### 2026-05-30: Phase 102 Documentation Generator Source Metadata Sanitization Regression Coverage

- Added deterministic documentation sanitization for source names, source references, relationships, auth sources, environment links, and integration sources.
- Added documentation-generator regression coverage for source metadata and references containing a fake provider key and denied `.env` evidence.
- Verified deterministic documentation output preserves redaction markers while excluding raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/documentation-generator typecheck
pnpm test -- packages/documentation-generator/src/generate-documentation-tree.test.ts
pnpm verify
```

### 2026-05-30: Phase 103 Documentation Generator Script And Dependency Sanitization Regression Coverage

- Added deterministic documentation sanitization for framework names, script names and commands, route/API paths, endpoint controllers, config kinds, API contract paths, dependency labels, risks, unknowns, and plan warnings.
- Added documentation-generator regression coverage for analyzer text fields containing a fake provider key and denied `.env` evidence.
- Verified deterministic documentation output preserves redaction markers while excluding raw provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm --filter @codebase-docs-ai/documentation-generator typecheck
pnpm test -- packages/documentation-generator/src/generate-documentation-tree.test.ts
pnpm verify
```

### 2026-05-30: Phase 104 Public Sanitizer Embedded Secret Regression Coverage

- Tightened public provider-key sanitizers so embedded keys adjacent to underscores or analyzer text are redacted consistently.
- Added/updated regression coverage across source-loader, API error envelopes, CLI error formatting, SDK errors, core propagated errors, AI provider errors, and the security redactor.
- Verified public errors preserve redaction markers while excluding raw embedded provider keys, denied `.env` evidence, and denied-source variable names.

Verification:

```text
pnpm -r --filter @codebase-docs-ai/security --filter @codebase-docs-ai/source-loader --filter @codebase-docs-ai/ai-orchestrator --filter @codebase-docs-ai/core --filter @codebase-docs-ai/sdk --filter @codebase-docs-ai/api --filter @codebase-docs-ai/cli typecheck
pnpm test -- packages/security/src/redact-secrets.test.ts packages/source-loader/src/load-source.test.ts packages/ai-orchestrator/src/openai-compatible-provider.test.ts packages/core/src/documentation-engine.test.ts apps/api/src/api-exception.filter.test.ts packages/sdk/src/client.test.ts apps/cli/src/cli-options.test.ts
pnpm verify
```

## Open Questions

- Should the Web UI be Next.js or Vite React? Decision for initial implementation: Vite React.
- Should the API run jobs in-process first or use BullMQ from the start? Decision for initial implementation: in-process.
- Which OpenAI-compatible provider/model should be configured first?
- What default upload limits should be used?
- Should generated output be stored only temporarily or persisted between server restarts?
