# Module Integration

`codebase-docs-ai` must be usable from other systems without requiring them to be Node.js projects.

## Integration Modes

### 1. HTTP API

Primary integration surface.

Use when:

- host application is not Node.js;
- module runs as a separate service;
- host needs language-agnostic integration;
- uploaded archives come from another backend.

Supported by:

- Python;
- PHP;
- Java;
- Kotlin;
- Go;
- C#;
- Node.js;
- no-code tools;
- internal AI factories and orchestration systems.

### 2. Node.js SDK

Convenience client for Node.js and TypeScript applications.

The SDK wraps HTTP API calls by default.

Optional local engine mode can be added later for Node.js projects that want to run the engine in-process.

### 3. CLI

Useful for:

- local testing;
- CI pipelines;
- one-off documentation generation;
- development fixtures.

Example:

```bash
pnpm --filter @codebase-docs-ai/cli exec tsx src/main.ts generate \
  --source ./frontend:frontend \
  --source ./backend:backend \
  --output ./generated-docs \
  --format single-markdown \
  --name "Generated Project Documentation"
```

The CLI accepts folders and archives. It runs the source loading, security filtering, repository analysis, system analysis, documentation generation, and rendering pipeline locally.

### 4. Web UI

Useful for:

- manual testing;
- demo workflows;
- validating output quality;
- operator review.

## External Host Example

An external AI factory can call:

```text
POST /v1/documentation-runs
POST /v1/documentation-runs/:runId/sources
POST /v1/documentation-runs/:runId/start
GET /v1/documentation-runs/:runId/result
```

The host owns:

- where archives come from;
- where generated docs go;
- user authentication;
- project-specific storage;
- downstream publication.

`codebase-docs-ai` owns:

- source loading;
- code analysis;
- AI documentation generation;
- output rendering.

## Boundary Rule

The module should not assume the host application's domain model.

The stable input is:

```text
sources + options
```

The stable output is:

```text
documentation tree + rendered artifacts + warnings
```
