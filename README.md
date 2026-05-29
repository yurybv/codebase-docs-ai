# codebase-docs-ai

Reusable AI documentation engine for analyzing one or more source-code archives and generating structured technical documentation.

## Product Shape

`codebase-docs-ai` is not a GitHub-only or Confluence-only integration. It is a standalone module:

```text
source archives / folders
  -> safe source loading
  -> deterministic code analysis
  -> cross-source system analysis
  -> AI-assisted documentation generation
  -> Markdown / JSON output
```

The module exposes:

- Web UI for manual testing and preview;
- HTTP API for integration from any language;
- Node.js SDK for TypeScript/Node projects;
- CLI for local and automation usage;
- core engine package reused by all surfaces.

## Current Repository Status

This repository now contains the first executable product slice:

```text
Web UI upload -> API run -> source extraction -> analysis -> documentation tree -> Markdown/JSON download
```

It also includes a typed SDK and a local CLI generation command.

Start with:

- [Product Specification](./codebase-docs-ai-project-documentation.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)
- [Project State](./docs/STATE.md)

## Documentation Index

- [API Contract](./docs/API_CONTRACT.md)
- [Product Features](./docs/FEATURES.md)
- [Module Integration](./docs/MODULE_INTEGRATION.md)
- [SDK Contract](./docs/SDK_CONTRACT.md)
- [Packaging And Public Boundaries](./docs/PACKAGING.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Development Workflow](./docs/DEVELOPMENT_WORKFLOW.md)
- [Security](./docs/SECURITY.md)
- [Rate Limiting](./docs/RATE_LIMITING.md)
- [Testing](./docs/TESTING.md)
- [Web QA](./docs/WEB_QA.md)
- [Operations](./docs/OPERATIONS.md)
- [Prompt Contracts](./docs/PROMPT_CONTRACTS.md)
- [Generation Prompt](./docs/GENERATION_PROMPT.md)
- [Autonomous Development Prompt](./docs/AUTONOMOUS_DEVELOPMENT_PROMPT.md)
- [Decision Log](./docs/DECISIONS.md)
- [External Rule Sources](./docs/EXTERNAL_RULE_SOURCES.md)

## CLI Usage

Generate documentation directly from local folders or archives:

```bash
pnpm --filter @codebase-docs-ai/cli exec tsx src/main.ts generate \
  --source ./frontend.zip:frontend \
  --source ./backend.zip:backend \
  --output ./generated-docs \
  --format markdown-tree \
  --name "Project Documentation"
```

Supported CLI formats:

```text
markdown-tree
single-markdown
json
zip
```

`zip` is a CLI convenience format that packages the Markdown tree as `documentation.zip`.

Run the same CLI against a running API service:

```bash
pnpm --filter @codebase-docs-ai/cli exec tsx src/main.ts generate \
  --api-url http://localhost:3000 \
  --source ./frontend.zip:frontend \
  --source ./backend.zip:backend \
  --output ./generated-docs \
  --format single-markdown
```

API mode accepts archive files. Use local mode when you want to pass local folders directly.

## Optional AI Provider

The product runs deterministically without AI credentials.

To enable OpenAI-compatible page generation in API and CLI runs, set:

```bash
export DOCS_AI_OPENAI_API_KEY="..."
export DOCS_AI_OPENAI_MODEL="..."
```

Optional:

```bash
export DOCS_AI_OPENAI_BASE_URL="https://api.openai.com/v1"
export DOCS_AI_OPENAI_TEMPERATURE="0.2"
```

No default model is hardcoded. The operator must choose the model explicitly.
