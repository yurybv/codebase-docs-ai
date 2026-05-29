# Autonomous Development Prompt

Use this prompt when the user approves full project generation and wants Codex to keep developing until a real blocker requires user input.

```text
You are working in the codebase-docs-ai repository.

Your goal is to implement the full product described by the project documentation, not a reduced MVP.

Read these files first:
- README.md
- AGENTS.md
- codebase-docs-ai-project-documentation.md
- docs/STATE.md
- docs/ARCHITECTURE.md
- docs/IMPLEMENTATION_PLAN.md
- docs/FEATURES.md
- docs/API_CONTRACT.md
- docs/MODULE_INTEGRATION.md
- docs/SECURITY.md
- docs/TESTING.md
- docs/PROMPT_CONTRACTS.md
- docs/GENERATION_PROMPT.md

Core product direction:
- The product accepts one or more source-code archives/folders.
- The product analyzes them safely and deterministically.
- The product correlates multiple sources such as frontend and backend.
- The product generates structured technical documentation.
- The product exposes UI, HTTP API, SDK, CLI, and core engine surfaces.
- GitHub and Confluence are future adapters, not core dependencies.

Development mode:
- Continue implementing phase by phase from docs/IMPLEMENTATION_PLAN.md.
- Do not stop after planning when implementation can proceed.
- Make reasonable engineering decisions when local context is enough.
- Keep core logic in packages, not in UI components or API controllers.
- Treat all uploaded archives and folders as untrusted input.
- Add tests for each meaningful package or behavior.
- Run relevant verification after each meaningful task.
- Update docs/STATE.md after meaningful progress.

Commit policy:
- Each meaningful completed task must be committed before moving to the next meaningful task.
- A meaningful task is a coherent reviewable unit, for example:
  - monorepo foundation;
  - shared contracts;
  - source loader;
  - security filtering/redaction;
  - repo analyzer;
  - system analyzer;
  - documentation generator;
  - renderer package;
  - API run lifecycle;
  - Web UI upload flow;
  - SDK client;
  - CLI command.
- Before every commit:
  - run relevant tests/typecheck/build if available;
  - inspect git status and git diff;
  - ensure no secrets, uploaded archives, private source, extracted source, or local env files are included;
  - update docs/STATE.md if the task changed project state.
- Use Conventional Commits.
- Keep commits compact and reviewable.

Stop only when:
- a product decision is required from the user;
- credentials or external service access are required;
- there is a technical ambiguity that cannot be resolved from repository context;
- verification is blocked by missing local tooling or environment issues that cannot be fixed safely;
- continuing would require changing the agreed product direction.

When blocked:
- explain the exact blocker;
- list what was completed;
- list the last successful verification;
- list the decision or input needed from the user;
- do not invent a workaround that changes product scope.

Start with the next incomplete phase from docs/IMPLEMENTATION_PLAN.md.
```

## Short Version

```text
Implement codebase-docs-ai phase by phase from the repository docs. Keep going until a real blocker needs my decision. Commit each meaningful completed task with Conventional Commits after relevant verification. Do not reduce scope to GitHub/Confluence integration; core input is archives/folders and core output is structured documentation.
```
