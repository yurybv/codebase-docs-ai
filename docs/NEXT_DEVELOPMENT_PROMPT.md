# Next Development Prompt

Use this prompt to continue autonomous development of `codebase-docs-ai`.

```text
You are working in /Users/yurybogdanov/Projects/codebase-docs-ai.

Continue developing the full product, not an MVP.

Important git workflow:
- Work directly on master.
- Do not create feature branches unless the user explicitly asks for a branch.
- Commit each meaningful completed task directly to master.
- Use Conventional Commits.
- Before each commit, inspect git status and git diff.
- Do not commit private archives, extracted real source, secrets, .env files, or local temporary artifacts.

Read these files first:
- README.md
- codebase-docs-ai-project-documentation.md
- docs/STATE.md
- docs/ARCHITECTURE.md
- docs/IMPLEMENTATION_PLAN.md
- docs/FEATURES.md
- docs/API_CONTRACT.md
- docs/MODULE_INTEGRATION.md
- docs/SDK_CONTRACT.md
- docs/PACKAGING.md
- docs/DEPLOYMENT.md
- docs/OPERATIONS.md
- docs/SECURITY.md
- docs/RATE_LIMITING.md
- docs/TESTING.md
- docs/WEB_QA.md
- docs/PROMPT_CONTRACTS.md
- docs/GENERATION_PROMPT.md
- docs/GIT_WORKFLOW.md

Current next implementation batch:
- Implement Phase 145: SDK And CLI Run Listing Updated-At Range Filters.
- Then continue without stopping into Phase 146: Web Run History Updated-At Range Controls And Audit.
- Then continue without stopping into Phase 147: API Run Listing Name Search Filter Contract.
- Then continue without stopping into Phase 148: SDK And CLI Run Listing Name Search Filters.
- If those finish cleanly, continue into the next highest-value product gap from docs/STATE.md and docs/IMPLEMENTATION_PLAN.md, update this file again, verify, and commit.

Phase 145 goal:
- Expose API run listing updated-at range filters through the SDK `documentationRuns.list` helper and CLI `list-runs` command.
- Validate SDK and CLI timestamp inputs before network requests where practical.
- Verify SDK and CLI date-filtered list requests preserve sanitized list output and invalid-date errors do not expose raw values.

Phase 146 goal:
- Expose updated-at range filters through the Web run history operator surface.
- Preserve Web run history limit/status/role/cursor behavior when date filters are applied.
- Audit API, SDK, CLI, and Web updated-at filtering as one cross-surface contract.
- Update README, API contract, SDK contract, Operations, Web QA, Testing, and State docs where the filtering behavior is now public.
- Confirm `docs/NEXT_DEVELOPMENT_PROMPT.md` is advanced to the next larger implementation batch before stopping.

Phase 147 goal:
- Add a safe API run listing name search filter for operator surfaces, such as `name`.
- Validate name-search inputs before storage access where practical, including length and blank-value handling.
- Return persisted run summaries matching sanitized run names without exposing artifact paths, upload storage paths, raw source content, or secret-bearing evidence.
- Cover created, completed, failed, and expired-cleaned runs where applicable, plus sanitized invalid-name errors.

Phase 148 goal:
- Expose the API run listing name search filter through the SDK `documentationRuns.list` helper and CLI `list-runs` command.
- Validate SDK and CLI name-search inputs before network requests where practical.
- Verify SDK and CLI name-filtered list requests preserve sanitized list output and invalid-name errors do not expose raw values.

Verification expectations:
- Run focused tests for every touched surface.
- Run focused typechecks for every touched package/app.
- Run `pnpm verify` before each completed phase commit unless a real blocker prevents it.
- Before every commit, inspect `git status`, `git diff`, `git diff --check`, and staged files.
- Commit each meaningful completed phase directly to master using Conventional Commits.
- Do not stop after one small task if the next task is clear and no user decision is required.

Product direction reminders:
- The product accepts one or more source-code archives/folders.
- The product analyzes sources safely and deterministically.
- The product correlates multiple sources such as frontend and backend.
- The product generates structured technical documentation.
- The product exposes Web UI, HTTP API, SDK, CLI, and core engine surfaces.
- GitHub, Confluence, Jira, and similar systems are future adapters, not core dependencies.
- The HTTP API is the universal integration boundary.
- The SDK is a TypeScript/Node convenience client, not the only integration path.
- The Web UI is the operator/manual testing surface and must not contain core analysis logic.

Continue phase by phase from docs/STATE.md. Stop only when a real blocker requires user input.
```
