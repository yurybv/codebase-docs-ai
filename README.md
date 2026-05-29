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

The module will expose:

- Web UI for manual testing and preview;
- HTTP API for integration from any language;
- Node.js SDK for TypeScript/Node projects;
- CLI for local and automation usage;
- core engine package reused by all surfaces.

## Current Repository Status

This repository is currently in product specification and implementation-planning stage.

Start with:

- [Product Specification](./codebase-docs-ai-project-documentation.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [Implementation Plan](./docs/IMPLEMENTATION_PLAN.md)
- [Project State](./docs/STATE.md)

## Documentation Index

- [API Contract](./docs/API_CONTRACT.md)
- [Product Features](./docs/FEATURES.md)
- [Module Integration](./docs/MODULE_INTEGRATION.md)
- [Development Workflow](./docs/DEVELOPMENT_WORKFLOW.md)
- [Security](./docs/SECURITY.md)
- [Testing](./docs/TESTING.md)
- [Prompt Contracts](./docs/PROMPT_CONTRACTS.md)
- [Generation Prompt](./docs/GENERATION_PROMPT.md)
- [Autonomous Development Prompt](./docs/AUTONOMOUS_DEVELOPMENT_PROMPT.md)
- [Decision Log](./docs/DECISIONS.md)
- [External Rule Sources](./docs/EXTERNAL_RULE_SOURCES.md)

## Next Action

After the specification is approved, generate the monorepo structure and implement the first full product slice:

```text
Web UI upload -> API run -> source extraction -> analysis -> documentation tree -> Markdown download
```
