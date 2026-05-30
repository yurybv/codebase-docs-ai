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
- Implement Phase 159: API Run Listing Created-At Range Filter Contract.
- Then continue without stopping into Phase 160: SDK And CLI Run Listing Created-At Range Filters.
- Then continue without stopping into Phase 161: Web Run History Created-At Range Controls And Audit.
- Then continue without stopping into Phase 162: Run Listing Created-At Cross-Surface Regression Audit.
- If those finish cleanly, continue into the next highest-value product gap from docs/STATE.md and docs/IMPLEMENTATION_PLAN.md, update this file again, verify, and commit.

Phase 159 goal:
- Add safe API run listing created-at range filters for operator surfaces, such as `createdAfter` and `createdBefore`.
- Validate created-at filter inputs before storage access where practical.
- Return persisted run summaries whose `createdAt` values match the selected range without exposing artifact paths, upload storage paths, raw source content, or secret-bearing evidence.
- Cover sanitized valid created-at filtering and invalid secret-bearing created-at errors.

Phase 160 goal:
- Expose API run listing created-at range filters through the SDK `documentationRuns.list` helper and CLI `list-runs` command.
- Validate SDK and CLI created-at filter inputs before network requests where practical.
- Verify SDK and CLI created-at filtered list requests preserve sanitized list output and invalid created-at errors do not expose raw values.

Phase 161 goal:
- Expose created-at range filtering through the Web run history operator surface.
- Preserve Web run history limit/status/role/name/format/source-count/updated-at/cursor behavior when created-at filtering is applied.
- Audit API, SDK, CLI, and Web created-at filtering as one cross-surface contract.
- Update README, API contract, SDK contract, Operations, Web QA, Testing, State, and this next prompt where the behavior is now public.

Phase 162 goal:
- Audit API, SDK, CLI, and Web created-at filtering as one public operator contract.
- Add or tighten regression coverage proving created-at filtering composes with `limit`, `status`, `role`, `name`, `format`, `minSources`, `maxSources`, `updatedAfter`, `updatedBefore`, and `cursor` where each surface supports them.
- Verify raw created-at filter input, provider keys, denied `.env` evidence, denied-source values, upload storage paths, and artifact paths remain absent from all surfaced list results and errors.
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
