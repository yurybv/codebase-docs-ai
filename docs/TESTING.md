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
