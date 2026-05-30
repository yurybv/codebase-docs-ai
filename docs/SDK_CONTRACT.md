# SDK Contract

This document defines the public TypeScript SDK contract for external Node.js and TypeScript consumers.

## Package Boundary

Stable entry point:

```ts
import { CodebaseDocsAIClient } from '@codebase-docs-ai/sdk';
```

The SDK is an HTTP client for the `codebase-docs-ai` API. It does not run source loading, analysis, AI generation, or rendering in-process.

Use the SDK when:

- the host is a Node.js or TypeScript application;
- the module runs as a separate API service;
- the host wants typed API calls and multipart upload handling.

Use the HTTP API directly when the host is not Node.js or when the host already owns HTTP client generation.

## Runtime Expectations

The SDK expects runtime support for:

```text
fetch
FormData
Blob
Response.blob()
```

Node.js `>=20.10.0` provides these APIs. Browser runtimes also provide them.

For tests or custom runtimes, pass a custom `fetch` implementation:

```ts
const client = new CodebaseDocsAIClient({
  apiBaseUrl: 'http://localhost:3000',
  fetch: customFetch
});
```

## Source File Inputs

The SDK upload boundary accepts archives as `Blob` values:

```ts
{
  name: 'Frontend',
  role: 'frontend',
  fileName: 'frontend.zip',
  file: frontendArchiveBlob
}
```

In Node.js, create the blob from archive bytes:

```ts
import { readFile } from 'node:fs/promises';

const file = new Blob([await readFile('./frontend.zip')]);
```

In browser code, use a `File` selected by the user:

```ts
const file = input.files?.[0];
```

`File` is a `Blob`, so it can be passed directly. Always pass a stable `fileName`; the API uses it for upload metadata and output diagnostics.

API mode accepts archives only. Folder inputs are CLI/local-engine concerns and are not part of the SDK upload contract.

## Examples

Copy-pasteable consumer examples live in:

```text
examples/sdk
```

They cover:

- Node.js archive upload and download persistence;
- browser `File` upload;
- custom polling and download;
- SDK error handling.

## Public Client Shape

```ts
const client = new CodebaseDocsAIClient({
  apiBaseUrl: 'http://localhost:3000'
});

client.documentationRuns;
```

The SDK currently exposes one resource group:

```text
documentationRuns
```

## Documentation Run Methods

### `create(input)`

Creates a run.

```ts
await client.documentationRuns.create({
  name: 'Project Documentation',
  options: {
    outputFormats: ['single-markdown'],
    language: 'en',
    includeSourceReferences: true,
    includeWarnings: true
  }
});
```

Returns:

```ts
{
  runId: string;
  status: DocumentationRunStatus;
}
```

### `list(options?)`

Lists persisted run summaries for operator surfaces. The SDK mirrors the API run listing filters used by Web run history and CLI `list-runs`.

```ts
const runs = await client.documentationRuns.list({
  limit: 25,
  status: 'completed',
  role: 'backend',
  name: 'backend',
  format: 'json',
  updatedAfter: '2026-05-30T00:00:00.000Z',
  updatedBefore: '2026-05-30T01:00:00.000Z',
  cursor: previousPage.nextCursor
});
```

Options:

- `limit`: optional integer from `1` to `100`. When omitted, the API default is used.
- `status`: optional `DocumentationRunStatus` filter.
- `role`: optional source role filter. Runs match when at least one uploaded source has this role.
- `name`: optional case-insensitive substring filter over sanitized run names.
- `format`: optional output format filter. Runs match when requested or rendered formats include this value.
- `updatedAfter`: optional ISO timestamp lower bound for `updatedAt`.
- `updatedBefore`: optional ISO timestamp upper bound for `updatedAt`.
- `cursor`: optional opaque pagination cursor returned by a previous list response.

Returns:

```ts
{
  runs: DocumentationRunSummary[];
  nextCursor?: string;
}
```

`nextCursor` is omitted when no further matching run summaries are available.

Run summaries include safe public metadata such as run id, name, status, source count, source names/roles, requested output formats, rendered formats, progress, failure summary, and timestamps. The SDK sanitizes list response text before exposing it to callers; list results must not include upload archive storage paths, result artifact paths, raw source content, or secret-bearing evidence.

### `uploadSources(runId, sources)`

Uploads one or more source archives.

Supported archive file names:

```text
.zip
.tar
.tar.gz
.tgz
```

Unsupported file names throw `CodebaseDocsAIClientError` before multipart request construction. The API upload boundary still performs authoritative validation.

```ts
await client.documentationRuns.uploadSources(runId, [
  {
    name: 'Frontend',
    role: 'frontend',
    fileName: 'frontend.zip',
    file
  }
]);
```

Returns run id, status, and accepted source metadata.

### `start(runId)`

Starts generation for a `ready` run.

```ts
await client.documentationRuns.start(runId);
```

Starting a run before sources are uploaded or after generation has already started returns an API error.

### `get(runId)`

Fetches persisted run state.

```ts
const run = await client.documentationRuns.get(runId);
```

Use this for custom polling, progress display, and failure reporting.

### `waitUntilComplete(runId, options?)`

Polls run state until completion or terminal failure.

```ts
const run = await client.documentationRuns.waitUntilComplete(runId, {
  intervalMs: 1000,
  timeoutMs: 120000
});
```

Defaults:

```text
intervalMs=1000
timeoutMs=120000
```

Throws `CodebaseDocsAIClientError` when the run reaches `failed`, `cancelled`, or `expired`, or when polling times out.

### `getResult(runId)`

Fetches the generated documentation tree.

```ts
const result = await client.documentationRuns.getResult(runId);
```

Returns:

```ts
{
  runId: string;
  status: DocumentationRunStatus;
  renderedFormats: DocumentationOutputFormat[];
  documentation: DocumentationTree;
}
```

`renderedFormats` lists the output artifacts available through `download(input)` for that completed run.

### `download(input)`

Downloads a rendered artifact.

```ts
const download = await client.documentationRuns.download({
  runId,
  format: 'single-markdown'
});
```

Returns:

```ts
{
  fileName: string | null;
  contentType: string | null;
  content: Blob;
}
```

The host decides where to store the downloaded blob.

### `delete(runId)`

Deletes temporary run artifacts from the API service.

```ts
await client.documentationRuns.delete(runId);
```

Returns:

```ts
{
  runId: string;
  deleted: boolean;
}
```

### `generateFromArchives(input)`

High-level helper for the complete API flow:

```text
create -> uploadSources -> start -> waitUntilComplete -> getResult -> optional download
```

Example:

```ts
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
      file
    }
  ],
  poll: {
    intervalMs: 1000,
    timeoutMs: 120000
  },
  downloadFormat: 'single-markdown'
});
```

Use this helper for simple host integrations. Use individual methods when the host needs custom persistence, progress UI, cancellation, retry behavior, or separate upload/start approval.

The returned `run.renderedFormats` and `result.renderedFormats` can be used to show download controls without assuming every requested format was rendered.

## Error Handling

The SDK throws `CodebaseDocsAIClientError` for non-2xx API responses, terminal polling failures, and client-side upload preflight failures.

Properties:

```ts
error.message;
error.status;
error.code;
error.details;
```

Example:

```ts
try {
  await client.documentationRuns.getResult(runId);
} catch (error) {
  if (error instanceof CodebaseDocsAIClientError) {
    console.error(error.status, error.code, error.message, error.details);
  }
}
```

For API responses, `code` and `details` are parsed from the public `{ error: ... }` envelope. Polling timeout, terminal run failures, and client-side upload preflight failures use status `0` because no failing HTTP response exists.

SDK-thrown error messages and details are sanitized before they are exposed to callers. Public SDK errors must not include raw provider keys, denied source evidence, or API run storage paths.

## Versioning Boundaries

Stable public SDK surface:

- `CodebaseDocsAIClient`;
- `CodebaseDocsAIClientError`;
- types exported from `@codebase-docs-ai/sdk`;
- shared public contracts exported from `@codebase-docs-ai/shared`;
- `documentationRuns` method names and input/output shapes.

Internal implementation details:

- HTTP client internals;
- polling loop implementation;
- multipart field names generated by the SDK;
- private helper functions;
- local engine execution.

Breaking changes include:

- renaming public methods;
- changing required input fields;
- changing output field meanings;
- changing `CodebaseDocsAIClientError` public properties;
- removing supported documentation output formats.

Non-breaking changes include:

- adding optional input fields;
- adding output fields;
- adding new documentation run statuses;
- adding new output formats while preserving existing formats;
- adding new resource groups under the client.
