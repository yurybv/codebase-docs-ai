# Operations

This document is the operator-facing runtime reference for `codebase-docs-ai`.

## Local Commands

Install dependencies:

```bash
pnpm install
```

Run all development checks:

```bash
pnpm build
pnpm typecheck
pnpm test
pnpm lint
pnpm smoke:e2e
```

Run the canonical full repository verification:

```bash
pnpm verify
```

Run API and Web together:

```bash
pnpm dev
```

Run the API only:

```bash
pnpm --filter @codebase-docs-ai/api dev
```

Run the Web UI only:

```bash
pnpm --filter @codebase-docs-ai/web dev
```

The Web run history panel can filter recent API runs by limit, status, source role, run name, output format, source count, sort direction, created-at range, updated-at range, and pagination cursor without exposing storage paths or secret-bearing evidence.

Run API and Web through Docker Compose:

```bash
docker compose up --build
```

Build deployment images:

```bash
pnpm docker:build:api
VITE_WEB_API_BASE_URL=http://localhost:3000 pnpm docker:build:web
```

Run the Docker runtime smoke test:

```bash
pnpm docker:smoke
```

## API Runtime

Default API port:

```text
3000
```

Configure:

```bash
export API_PORT=3000
```

Health check:

```text
GET /health
```

Run artifact root:

```bash
export DOCS_AI_TMP_DIR=.tmp/codebase-docs-ai
```

Run retention:

```bash
export DOCS_AI_RUN_RETENTION_MS=86400000
export DOCS_AI_RUN_CLEANUP_INTERVAL_MS=3600000
```

`DOCS_AI_RUN_RETENTION_MS` controls when a run is old enough to delete. `DOCS_AI_RUN_CLEANUP_INTERVAL_MS` controls how often the API scans for expired runs. Set `DOCS_AI_RUN_CLEANUP_INTERVAL_MS=0` to disable the runtime scheduler when cleanup is owned by the host platform.

Invalid retention or cleanup interval values fall back to defaults. Setting `DOCS_AI_RUN_RETENTION_MS=0` makes runs eligible for deletion at the cleanup timestamp; setting `DOCS_AI_RUN_CLEANUP_INTERVAL_MS=0` disables only the recurring scheduler.

## Upload Limits

Multipart source uploads are limited before archive extraction.

Defaults:

```bash
export DOCS_AI_UPLOAD_MAX_FILES=5
export DOCS_AI_UPLOAD_MAX_FILE_SIZE_BYTES=104857600
```

The Web UI can mirror these limits:

```bash
export VITE_WEB_UPLOAD_MAX_FILES=5
export VITE_WEB_UPLOAD_MAX_FILE_SIZE_BYTES=104857600
```

For public or multi-tenant deployments, enforce rate limits and request body limits at the host gateway or reverse proxy. See [Rate Limiting](./RATE_LIMITING.md).

## Web Runtime

Default Web port:

```text
5173
```

Configure:

```bash
export WEB_PORT=5173
export VITE_WEB_API_BASE_URL=http://localhost:3000
```

`WEB_API_BASE_URL` is still accepted as a fallback, but `VITE_WEB_API_BASE_URL` should be preferred for Vite.

## Optional AI Provider

The product works without AI credentials. When credentials are absent, deterministic documentation generation is used.

Enable an OpenAI-compatible provider:

```bash
export DOCS_AI_OPENAI_API_KEY=...
export DOCS_AI_OPENAI_MODEL=...
```

Optional:

```bash
export DOCS_AI_OPENAI_BASE_URL=https://api.openai.com/v1
export DOCS_AI_OPENAI_TEMPERATURE=0.2
```

No model is hardcoded. Operators must choose the model explicitly.

AI provider configuration is fail-fast. If any `DOCS_AI_OPENAI_*` variable or fallback OpenAI key/model variable is present, both key and model must be configured. `DOCS_AI_OPENAI_BASE_URL` must be an HTTP(S) URL, and `DOCS_AI_OPENAI_TEMPERATURE` must be a number between `0` and `2`.

## CLI Local Mode

Use local mode for archives or folders:

```bash
pnpm --filter @codebase-docs-ai/cli exec tsx src/main.ts generate \
  --source ./frontend:frontend \
  --source ./backend:backend \
  --output ./generated-docs \
  --format single-markdown \
  --name "Generated Project Documentation"
```

Supported formats:

```text
markdown-tree
single-markdown
json
zip
```

## CLI API Mode

Use API mode when the module runs as a separate service:

```bash
pnpm --filter @codebase-docs-ai/cli exec tsx src/main.ts generate \
  --api-url http://localhost:3000 \
  --source ./frontend.zip:frontend \
  --source ./backend.zip:backend \
  --output ./generated-docs \
  --format single-markdown
```

API mode accepts `.zip`, `.tar`, `.tar.gz`, and `.tgz` archive files. Use local mode for direct folder input.

List recent API runs without downloading artifacts:

```bash
pnpm --filter @codebase-docs-ai/cli exec tsx src/main.ts list-runs \
  --api-url http://localhost:3000 \
  --limit 25 \
  --status completed \
  --role backend \
  --name backend \
  --format json \
  --min-sources 1 \
  --max-sources 2 \
  --sort createdAt:asc \
  --created-after 2026-05-29T23:00:00.000Z \
  --created-before 2026-05-30T01:00:00.000Z \
  --updated-after 2026-05-30T00:00:00.000Z \
  --updated-before 2026-05-30T01:00:00.000Z \
  --cursor eyJ1cGRhdGVkQXQiOiIyMDI2LTA1LTMwVDAwOjAxOjAwLjAwMFoiLCJpZCI6InJ1bl8xMjMifQ
```

When the API returns `nextCursor`, pass that value to `--cursor` to continue listing the next page with the same limit, status, role, name, output-format, source-count, sort, created-at, and updated-at filters. CLI list output is sanitized and must not expose raw cursor input, provider keys, denied source evidence, upload storage paths, or artifact paths.

CLI failures are printed as JSON to stderr:

```json
{
  "status": "failed",
  "exitCode": 2,
  "error": {
    "code": "CLI_SOURCE_REQUIRED",
    "message": "At least one --source path:role input is required."
  }
}
```

User input/configuration errors use exit code `2`. Runtime/API failures use exit code `1`.

CLI failure output is sanitized before printing. It must not include raw provider keys, denied source evidence, or API run storage paths.

## SDK Usage

The SDK wraps the HTTP API and is optional. Non-Node systems should call the API directly.

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
  downloadFormat: 'single-markdown'
});
```

## Smoke Verification

Run:

```bash
pnpm smoke:e2e
```

The smoke harness:

- starts API and Web dev servers;
- creates frontend/backend fixture archives;
- verifies API create/upload/start/result/download lifecycle across JSON, single-Markdown, and markdown-tree outputs;
- verifies CLI API mode against the running API across all CLI output formats;
- verifies Web root reachability.

## Storage And Cleanup

The API stores temporary run state under `DOCS_AI_TMP_DIR`.

Each run directory contains:

```text
run.json
uploads/
extracted/
results/
```

The cleanup boundary removes run directories whose `updatedAt` is older than `DOCS_AI_RUN_RETENTION_MS`. The API runs this cleanup once on module startup and then every `DOCS_AI_RUN_CLEANUP_INTERVAL_MS` milliseconds unless the interval is set to `0`.

## Security Notes

- Never upload real private archives into committed fixtures.
- Do not log uploaded source content.
- Do not log prompt payloads containing private code.
- Keep upload limits aligned between API and Web deployments.
- Treat generated documentation as source-derived output that may still require human review before external publication.
