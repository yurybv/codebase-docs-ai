# Project Agent Rules

These rules apply to all AI-assisted development in this repository.

## Product Intent

Build `codebase-docs-ai` as a reusable documentation module that accepts one or more source-code archives/folders, analyzes them safely, and generates structured technical documentation through UI, API, SDK, and CLI surfaces.

The core product must not depend on GitHub, Confluence, Jira, or any other external integration. Those can be future adapters.

## Stack Direction

- Language: TypeScript.
- Package manager: pnpm.
- Repository shape: monorepo.
- API: NestJS REST API.
- UI: React or Next.js, selected during implementation.
- Testing: Vitest for packages, API integration tests, Playwright only when UI flows need verification.
- AI: provider abstraction, OpenAI-compatible adapter first unless changed by the user.

## Core Workflow

1. Read `README.md`, `codebase-docs-ai-project-documentation.md`, and `docs/STATE.md` before major work.
2. Check `docs/IMPLEMENTATION_PLAN.md` for the current phase.
3. Keep core logic in packages, not in UI/API handlers.
4. Add tests for source loading, filtering, redaction, analysis, rendering, and API behavior.
5. Run relevant verification before finishing.
6. Update `docs/STATE.md` after meaningful implementation progress.
7. Never overwrite user changes without explicit permission.
8. Never commit secrets, uploaded archives, extracted private source, or local env files.

## Architecture Rules

- `packages/core` orchestrates the engine.
- `packages/source-loader` owns archive/folder loading.
- `packages/security` owns denylist, redaction, and prompt safety.
- `packages/repo-analyzer` analyzes one source input.
- `packages/system-analyzer` correlates multiple source inputs.
- `packages/documentation-generator` creates `DocumentationTree`.
- `packages/renderers` turns `DocumentationTree` into output artifacts.
- `apps/api`, `apps/web`, and `apps/cli` call packages instead of duplicating logic.

## Security Rules

- Treat every uploaded archive as untrusted.
- Prevent path traversal during archive extraction.
- Enforce file count and size limits.
- Never send `.env`, private keys, credentials, or generated/binary files to AI.
- Redact likely secrets before prompt creation.
- Do not log raw source code, secrets, or full prompts containing private source.
- Use safe error messages in API responses.

## AI Rules

- AI explains and writes documentation from structured context.
- AI does not receive raw archives.
- AI output must be schema-validated.
- Generated docs must mention uncertainty when source evidence is incomplete.
- Generated docs must include source references when available.

## Git Rules

- Use focused branches.
- Use Conventional Commits.
- Review `git diff` before commit.
- Keep unrelated changes out of commits.
- Update docs when architecture, API, commands, env vars, or workflows change.

## Documentation Rules

- Durable project knowledge belongs in `docs/`.
- `docs/STATE.md` is the handoff file for future sessions.
- Feature-level plans should be added to `docs/features/` when implementation starts.
- Keep documentation in English unless the user explicitly asks otherwise.
