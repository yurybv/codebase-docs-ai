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
- Implement Phase 155: API Run Listing Source Count Filter Contract.
- Then continue without stopping into Phase 156: SDK And CLI Run Listing Source Count Filters.
- Then continue without stopping into Phase 157: Web Run History Source Count Filter Control And Audit.
- Then continue without stopping into Phase 158: Run Listing Source Count Cross-Surface Regression Audit.
- If those finish cleanly, continue into the next highest-value product gap from docs/STATE.md and docs/IMPLEMENTATION_PLAN.md, update this file again, verify, and commit.

Phase 155 goal:
- Add safe API run listing source-count filters for operator surfaces, such as `minSources` and `maxSources`.
- Validate source-count filter inputs before storage access where practical.
- Return persisted run summaries whose source counts match the selected range without exposing artifact paths, upload storage paths, raw source content, or secret-bearing evidence.
- Cover sanitized valid source-count filtering and invalid secret-bearing source-count errors.

Phase 156 goal:
- Expose API run listing source-count filters through the SDK `documentationRuns.list` helper and CLI `list-runs` command.
- Validate SDK and CLI source-count filter inputs before network requests where practical.
- Verify SDK and CLI source-count filtered list requests preserve sanitized list output and invalid source-count errors do not expose raw values.

Phase 157 goal:
- Expose source-count filtering through the Web run history operator surface.
- Preserve Web run history limit/status/role/name/format/updated-at/cursor behavior when source-count filtering is applied.
- Audit API, SDK, CLI, and Web source-count filtering as one cross-surface contract.
- Update README, API contract, SDK contract, Operations, Web QA, Testing, State, and this next prompt where the behavior is now public.

Phase 158 goal:
- Audit API, SDK, CLI, and Web source-count filtering as one public operator contract.
- Add or tighten regression coverage proving source-count filtering composes with `limit`, `status`, `role`, `name`, `format`, `updatedAfter`, `updatedBefore`, and `cursor` where each surface supports them.
- Verify raw source-count filter input, provider keys, denied `.env` evidence, denied-source values, upload storage paths, and artifact paths remain absent from all surfaced list results and errors.
- Update docs only if the audit changes public behavior or testing expectations.

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
