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

Full public method, error handling, and file input contract: [SDK Contract](./SDK_CONTRACT.md).

Example:

```ts
import { CodebaseDocsAIClient } from '@codebase-docs-ai/sdk';

const client = new CodebaseDocsAIClient({
  apiBaseUrl: 'http://localhost:3000'
});

const result = await client.documentationRuns.generateFromArchives({
  name: 'Generated Project Documentation',
  options: {
    outputFormats: ['single-markdown'],
    language: 'en',
    includeSourceReferences: true,
    includeWarnings: true
  },
  sources: [
    {
      name: 'Frontend',
      role: 'frontend',
      fileName: 'frontend.zip',
      file: frontendArchiveBlob
    }
  ],
  poll: {
    intervalMs: 1000,
    timeoutMs: 120000
  },
  downloadFormat: 'single-markdown'
});
```

The helper creates a run, uploads archives, starts generation, polls until completion, retrieves the documentation tree, and optionally downloads a rendered artifact.

After completion, `run.renderedFormats` and `result.renderedFormats` list the formats that can be downloaded for that run. Host applications should build download UI from this list instead of assuming every supported format is present.

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

The CLI can also operate against a running API service:

```bash
pnpm --filter @codebase-docs-ai/cli exec tsx src/main.ts generate \
  --api-url http://localhost:3000 \
  --source ./frontend.zip:frontend \
  --source ./backend.zip:backend \
  --output ./generated-docs \
  --format single-markdown
```

In API mode, source inputs must be `.zip`, `.tar`, `.tar.gz`, or `.tgz` archive files because the HTTP API upload boundary accepts archives.

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
