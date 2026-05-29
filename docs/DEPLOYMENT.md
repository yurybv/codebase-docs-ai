# Deployment

This document describes how to run `codebase-docs-ai` as an external module service.

## Deployment Shape

The deployable service shape is:

```text
external host or operator
  -> Web UI or HTTP API
  -> API service
  -> temporary run storage
  -> Markdown / JSON artifacts
```

The API is the required service. The Web UI is optional and exists for manual operation, QA, and demos.

## Docker Targets

The root `Dockerfile` exposes two targets:

```text
api
web
```

Build the API image:

```bash
pnpm docker:build:api
```

Build the Web image:

```bash
VITE_WEB_API_BASE_URL=http://localhost:3000 pnpm docker:build:web
```

`VITE_WEB_API_BASE_URL` is a Vite build-time value. Rebuild the Web image when the browser-facing API URL changes.

## Docker Compose

Run API and Web together:

```bash
docker compose up --build
```

Run a container runtime smoke test:

```bash
pnpm docker:smoke
```

The smoke script starts API and Web containers with Docker Compose, checks API `/health`, checks Web reachability, and then stops the compose project with volumes removed.

Default URLs:

```text
API: http://localhost:3000
Web: http://localhost:5173
```

The compose file stores API run artifacts in the `codebase_docs_ai_tmp` volume.

## API Container Runtime

Required:

```bash
API_PORT=3000
DOCS_AI_TMP_DIR=/data/codebase-docs-ai
```

Recommended:

```bash
DOCS_AI_RUN_RETENTION_MS=86400000
DOCS_AI_UPLOAD_MAX_FILES=5
DOCS_AI_UPLOAD_MAX_FILE_SIZE_BYTES=104857600
```

Optional AI provider:

```bash
DOCS_AI_OPENAI_API_KEY=...
DOCS_AI_OPENAI_MODEL=...
DOCS_AI_OPENAI_BASE_URL=https://api.openai.com/v1
DOCS_AI_OPENAI_TEMPERATURE=0.2
```

AI provider configuration is fail-fast. Partial provider configuration should fail deployment startup instead of silently falling back to deterministic generation.

The API must have writable storage at `DOCS_AI_TMP_DIR`.

## Web Container Runtime

Runtime:

```bash
WEB_PORT=5173
VITE_WEB_UPLOAD_MAX_FILES=5
VITE_WEB_UPLOAD_MAX_FILE_SIZE_BYTES=104857600
```

Browser-facing API URL:

```bash
VITE_WEB_API_BASE_URL=http://localhost:3000
```

This value is baked into the Web bundle during `docker build`.

## Production Notes

- Put the API behind the host application's authentication or a trusted gateway before accepting private code.
- Keep API upload limits aligned with any reverse proxy body-size limits.
- Mount persistent or temporary storage for `DOCS_AI_TMP_DIR` depending on retention requirements.
- Treat generated documentation as source-derived output and control access accordingly.
- Configure the Web bundle with the URL that browsers can reach, not the internal container hostname.
- Use the HTTP API as the stable integration boundary for non-Node host systems.

## Verification

Validate compose syntax:

```bash
pnpm docker:compose:config
```

Run the repository verification before building deployment images:

```bash
pnpm verify
```

Run the container runtime smoke test after image or compose changes:

```bash
pnpm docker:smoke
```
