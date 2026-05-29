# Project State

This file is the durable handoff for future sessions.

## Current Stage

Product specification and implementation planning.

No application code has been generated yet.

## Product Decision Log

### 2026-05-29

- The product is not GitHub-first.
- The product is not Confluence-first.
- Core input is one or more source archives or folders.
- Core output is a structured documentation tree rendered to Markdown/JSON.
- GitHub and Confluence are future adapters, not core dependencies.
- The module must work through API for any external project/language.
- Node.js SDK is useful but not the only integration path.
- Web UI exists primarily for manual testing and operator usage.
- The system must support frontend/backend archives analyzed together.
- Documentation and specification should be written in English.

## Current Source Of Truth

- Product specification: `codebase-docs-ai-project-documentation.md`
- Architecture: `docs/ARCHITECTURE.md`
- API contract: `docs/API_CONTRACT.md`
- Implementation plan: `docs/IMPLEMENTATION_PLAN.md`
- Security: `docs/SECURITY.md`
- Testing: `docs/TESTING.md`
- Prompt contracts: `docs/PROMPT_CONTRACTS.md`
- External source docs: `docs/EXTERNAL_RULE_SOURCES.md`

## Reviewed External Inputs

### project-rule-templates

Useful for:

- AGENTS rules;
- development workflow;
- git workflow;
- security;
- testing;
- code review;
- PR template.

Decision:

- Adapt manually.
- Do not run the script blindly.

### ECC

Useful for:

- plan-first workflow;
- TDD discipline;
- security-first review;
- TypeScript coding style;
- prompt patterns;
- documentation update workflow.

Decision:

- Borrow ideas.
- Do not copy ECC-specific agent/harness content directly.

## Next Required User Approval

Before generating application code, confirm:

1. The full product direction is correct.
2. Documentation should remain English-only.
3. The implementation should start from the monorepo foundation.
4. The first executable product slice should be:

```text
Web UI upload -> API run -> source extraction -> analysis -> documentation tree -> Markdown download
```

## Next Implementation Step

Generate monorepo foundation:

```text
package.json
pnpm-workspace.yaml
turbo.json
tsconfig.base.json
apps/api
apps/web
apps/cli
packages/shared
packages/core
```

Then implement shared contracts before any UI/API behavior.

## Open Questions

- Should the Web UI be Next.js or Vite React?
- Should the API run jobs in-process first or use BullMQ from the start?
- Which OpenAI-compatible provider/model should be configured first?
- What default upload limits should be used?
- Should generated output be stored only temporarily or persisted between server restarts?
