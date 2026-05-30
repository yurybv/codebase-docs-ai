# Testing

The project should use tests to protect the engine contracts and security boundaries.

## Test Priorities

Highest priority:

1. Safe archive extraction.
2. File filtering and denylist behavior.
3. Secret redaction.
4. Repository map generation.
5. System relationship detection.
6. Documentation tree validation.
7. Markdown/JSON renderer output.
8. API upload and result flow.

## Recommended Tools

- Vitest for package unit tests.
- Supertest or equivalent for NestJS API integration tests.
- Playwright only for critical UI flows after the UI exists.

## Unit Tests

Cover:

- path traversal rejection;
- file inventory creation;
- ignore pattern matching;
- package manager detection;
- Next.js route detection;
- NestJS controller detection;
- API client detection;
- env var detection;
- redaction patterns;
- documentation tree schemas;
- renderer file naming.

## Integration Tests

Cover:

- one archive -> documentation result;
- frontend + backend archive -> system map;
- invalid archive -> safe error;
- secret file upload -> denied or redacted;
- API run lifecycle;
- result download.
- API/SDK/Web/CLI run listing pagination with sanitized `nextCursor` handling.

The API package includes HTTP-level lifecycle coverage:

```text
apps/api/src/documentation-runs.http.test.ts
```

This test boots the real Nest app on an ephemeral port and verifies public request/response behavior for create, upload, start, result, download, delete, and standardized error envelopes.

## Documentation Quality Fixture

The core package includes a representative frontend/backend quality fixture:

```text
packages/core/src/documentation-quality.test.ts
```

This fixture creates a small Next.js-style frontend and NestJS-style backend, runs the real engine pipeline, and asserts that generated documentation covers:

- system architecture;
- matched API contracts;
- frontend routes;
- backend endpoints;
- environment variables;
- local test scripts;
- deployment evidence;
- external integrations;
- auth evidence;
- rendered Markdown and JSON artifacts.

Use this test as the minimum quality bar for product documentation output when changing analyzers, system mapping, generation, or renderers.

## Smoke Harness

Run:

```bash
pnpm smoke:e2e
```

The smoke harness starts local API and Web dev servers, creates frontend/backend fixture archives, uploads them through the HTTP API, starts generation, verifies the result, verifies JSON/single-Markdown/markdown-tree download content, verifies CLI API-mode generation for all CLI output formats, and checks that the Web root is reachable.

This harness is intentionally lightweight. It does not replace full browser automation, but it protects server startup, multipart upload, API lifecycle, artifact download, and Web/API environment wiring.

## Run Listing Pagination Regression

Run listing pagination is a cross-surface contract. When changing API run listing, SDK list helpers, CLI `list-runs`, or Web run history, verify that:

- first-page and cursor-page requests preserve selected `limit`, `status`, `role`, `name`, `format`, source-count, created-at, and updated-at filters;
- `nextCursor` is omitted when no more matching runs are available;
- API, SDK, Web, and CLI surfaces do not expose raw cursor input, raw `nextCursor` values, upload storage paths, artifact paths, denied `.env` evidence, or secret-bearing values;
- invalid cursor errors use stable public error codes and sanitized messages.

## Run Listing Updated-At Filter Regression

Run listing updated-at filtering is a cross-surface contract. When changing API run listing, SDK list helpers, CLI `list-runs`, or Web run history, verify that:

- `updatedAfter` and `updatedBefore` filters are forwarded as ISO timestamp query parameters;
- updated-at filtering composes with selected `limit`, `status`, `role`, `name`, `format`, `minSources`, `maxSources`, `createdAfter`, `createdBefore`, and `cursor` options;
- API, SDK, Web, and CLI surfaces do not expose raw timestamp input, provider keys, denied source evidence, upload storage paths, or artifact paths;
- invalid updated-at filter errors use stable public error codes and sanitized messages.

## Run Listing Created-At Filter Regression

Run listing created-at filtering is a cross-surface contract. When changing API run listing, SDK list helpers, CLI `list-runs`, or Web run history, verify that:

- `createdAfter` and `createdBefore` filters are forwarded as ISO timestamp query parameters;
- created-at filtering composes with selected `limit`, `status`, `role`, `name`, `format`, `minSources`, `maxSources`, `updatedAfter`, `updatedBefore`, and `cursor` options;
- API, SDK, Web, and CLI surfaces do not expose raw timestamp input, provider keys, denied source evidence, upload storage paths, or artifact paths;
- invalid created-at filter errors use stable public error codes and sanitized messages.

## Run Listing Name Filter Regression

Run listing name filtering is a cross-surface contract. When changing API run listing, SDK list helpers, CLI `list-runs`, or Web run history, verify that:

- `name` filters are forwarded as sanitized run-name substring query parameters;
- name filtering composes with selected `limit`, `status`, `role`, `format`, `minSources`, `maxSources`, `createdAfter`, `createdBefore`, `updatedAfter`, `updatedBefore`, and `cursor` options;
- API, SDK, Web, and CLI surfaces do not expose raw name input, provider keys, denied source evidence, upload storage paths, or artifact paths;
- invalid name filter errors use stable public error codes and sanitized messages.

## Run Listing Output-Format Filter Regression

Run listing output-format filtering is a cross-surface contract. When changing API run listing, SDK list helpers, CLI `list-runs`, or Web run history, verify that:

- `format` filters are forwarded as supported documentation output format query parameters;
- format filtering composes with selected `limit`, `status`, `role`, `name`, `minSources`, `maxSources`, `createdAfter`, `createdBefore`, `updatedAfter`, `updatedBefore`, and `cursor` options;
- API, SDK, Web, and CLI surfaces do not expose raw format input, provider keys, denied source evidence, upload storage paths, or artifact paths;
- invalid format filter errors use stable public error codes and sanitized messages.

## Run Listing Source-Count Filter Regression

Run listing source-count filtering is a cross-surface contract. When changing API run listing, SDK list helpers, CLI `list-runs`, or Web run history, verify that:

- `minSources` and `maxSources` filters are forwarded as non-negative integer query parameters;
- source-count filtering composes with selected `limit`, `status`, `role`, `name`, `format`, `createdAfter`, `createdBefore`, `updatedAfter`, `updatedBefore`, and `cursor` options;
- API, SDK, Web, and CLI surfaces do not expose raw source-count input, provider keys, denied source evidence, upload storage paths, or artifact paths;
- invalid source-count filter errors use stable public error codes and sanitized messages.

## Web Completed-State Regression

Run:

```bash
pnpm web:completed-state
```

The completed-state regression renders the Web app in jsdom with API-shaped mocked responses and verifies:

- multi-archive upload;
- frontend/backend role selection;
- output format selection;
- metadata sent to the upload API;
- selected formats sent to the create-run API;
- completed download controls built from API-provided rendered formats;
- client-side unsupported archive file rejection;
- completed run status and progress;
- generated page navigation;
- Markdown preview updates;
- download controls aligned to selected formats.

This test is not a visual browser replacement. It protects the Web operator flow at the DOM/API-contract boundary and keeps the manual browser checks in `docs/WEB_QA.md` repeatable enough to catch regressions before manual QA.

## Snapshot Tests

Use snapshots carefully for generated docs and rendered output. Prefer stable snapshots based on fixture projects.

Fixture examples:

```text
examples/fixtures/next-app
examples/fixtures/nest-api
examples/fixtures/fullstack-system
```

## Test Data Rules

- Never use real private project archives in committed tests.
- Use small artificial fixtures.
- Do not include real secrets.
- Include fake secrets only when testing redaction.
