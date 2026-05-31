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
- Implement Phase 195: API Run Listing Status-Then-Updated Composite Sort Contract.
- Then continue without stopping into Phase 196: SDK And CLI Run Listing Composite Sort Option.
- Then continue without stopping into Phase 197: Web Run History Composite Sort Control.
- Then continue without stopping into Phase 198: Run Listing Composite Sort Cross-Surface Regression Audit.
- Then continue without stopping into Phase 199: Live Provider Testing Runbook And Fixture Smoke Prep.
- Then continue without stopping into Phase 200: Real OpenAI Provider Configuration And Smoke Command Preparation.
- Then continue without stopping into Phase 201: Private Input Testing Iteration Preparation.
- Then continue without stopping into Phase 202: Web/API Live Operator Validation Preparation.
- If those finish cleanly, continue into the next highest-value product gap from docs/STATE.md and docs/IMPLEMENTATION_PLAN.md, update this file again, verify, and commit.

Phase 195 goal:
- Add a safe API run listing composite sort preset for operator surfaces, prioritizing status groups and then recent activity, for example a `statusThenUpdated` sort family.
- Keep composite-sorted pagination deterministic without exposing storage paths, upload paths, raw source content, or secret-bearing evidence.
- Cover composite-sorted first-page and cursor-page behavior with sanitized invalid-sort errors.

Phase 196 goal:
- Expose composite sort options through SDK `documentationRuns.list({ sort })` and CLI `list-runs --sort`.
- Validate SDK and CLI composite sort inputs before network requests where practical.
- Verify SDK and CLI composite-sorted list requests preserve sanitized list output and invalid-sort errors do not expose raw values.

Phase 197 goal:
- Expose composite sorting through the Web run history sort selector.
- Preserve Web run history limit/status/role/name/format/source-count/created-at/completed-at/updated-at/cursor behavior when composite sorting is applied.
- Verify composite-sorted Web history displays sanitized summary metadata without adding core logic to the Web surface.

Phase 198 goal:
- Audit API, SDK, CLI, and Web composite sort behavior as one public operator contract.
- Add or tighten regression coverage proving composite sorting composes with run listing filters and pagination where applicable.
- Verify raw sort inputs, provider keys, denied `.env` evidence, denied-source values, upload storage paths, and artifact paths remain absent from surfaced list results and errors.

Phase 199 goal:
- Turn the current testing guidance into an explicit testing iteration that separates repository-only verification, fixture-based live-provider smoke coverage, private-input validation, and Web/API operator validation.
- Document exactly when the user must provide nothing, when the user must provide provider credentials, and when the user must provide private source inputs.
- Keep the testing plan aligned with security rules so no private archives, extracted private source, or secrets are committed.

Phase 200 goal:
- Add or tighten the real-provider smoke-test workflow for API and CLI surfaces using environment-driven OpenAI-compatible configuration.
- Make the live-provider test entrypoints obvious and safe to run only when credentials are intentionally present.
- Verify provider configuration failures stay sanitized and fail fast before private-input testing begins.

Phase 201 goal:
- Prepare the private-input testing iteration for local and API flows.
- Define what archive/folder data the user needs to provide, what temporary outputs may be created, and what cleanup rules apply after testing.
- Keep private-input validation separate from committed fixtures and deterministic regression tests.

Phase 202 goal:
- Prepare the Web/API live operator validation iteration after fixture-based and private-input CLI/API checks succeed.
- Define the exact manual checks for upload, progress, result preview, downloads, run history, and sanitized failure rendering with live-provider-backed runs.
- Update README, Operations, Testing, Web QA, State, and this prompt where the testing workflow becomes part of the durable operator guidance.

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

Testing iteration reminders:
- Do not request a real OpenAI API key during repository-only implementation phases unless the live-provider preparation phases have been reached and local verification is already green.
- Do not request private source archives until fixture-based live-provider smoke tests succeed.
- When live-provider testing starts, prefer temporary environment variables and local-only handling of private inputs.
- Never commit private archives, extracted private source, live-provider responses containing private code, or plaintext credentials.

Continue phase by phase from docs/STATE.md. Stop only when a real blocker requires user input.
```
