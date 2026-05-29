# Environment

This document defines expected environment variables for the product.

## Local Development

Required tools:

```text
Node.js:
pnpm:
```

Exact versions should be finalized during monorepo setup.

## Core Environment Variables

```bash
NODE_ENV=development

# API
API_PORT=3000
API_BASE_URL=http://localhost:3000

# Web
WEB_PORT=5173
WEB_API_BASE_URL=http://localhost:3000

# AI provider
AI_PROVIDER=openai-compatible
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=

# Temporary file storage
DOCS_AI_TMP_DIR=.tmp/codebase-docs-ai
DOCS_AI_MAX_ARCHIVE_SIZE_MB=100
DOCS_AI_MAX_EXTRACTED_FILES=5000
DOCS_AI_MAX_FILE_SIZE_MB=2
DOCS_AI_RUN_RETENTION_HOURS=24
```

## Future Environment Variables

```bash
# Optional persistence
DATABASE_URL=
REDIS_URL=

# Future adapters
GITHUB_TOKEN=
CONFLUENCE_BASE_URL=
CONFLUENCE_EMAIL=
CONFLUENCE_API_TOKEN=
```

## Rules

- Commit `.env.example` with placeholder values only.
- Never commit real `.env` files.
- Validate required variables at startup.
- Keep adapter-specific variables optional until adapters exist.
