# Generation Prompt

Use this prompt when starting full project implementation after approval.

```text
Build the codebase-docs-ai project according to the repository documentation.

Read first:
- README.md
- AGENTS.md
- codebase-docs-ai-project-documentation.md
- docs/STATE.md
- docs/ARCHITECTURE.md
- docs/IMPLEMENTATION_PLAN.md
- docs/SECURITY.md
- docs/API_CONTRACT.md
- docs/TESTING.md
- docs/PROMPT_CONTRACTS.md
- docs/AUTONOMOUS_DEVELOPMENT_PROMPT.md

Implement the product as a TypeScript pnpm monorepo.

Do not reduce scope to a GitHub-only or Confluence-only MVP. The product must accept source archives/folders and generate documentation output.

Start with Phase 1 from docs/IMPLEMENTATION_PLAN.md:
- package.json
- pnpm-workspace.yaml
- turbo.json if useful
- tsconfig base
- apps/api
- apps/web
- apps/cli
- packages/shared
- packages/core

Then continue phase by phase:
1. source-loader
2. security
3. repo-analyzer
4. system-analyzer
5. ai-orchestrator
6. documentation-generator
7. renderers
8. API
9. Web UI
10. SDK
11. CLI

Keep core logic in packages.
Do not put engine logic in UI components or API controllers.
Treat all uploaded archives as untrusted.
Add tests as packages are implemented.
Update docs/STATE.md after meaningful progress.

Continue implementation until blocked by a real product decision, missing credential, missing external service choice, or technical ambiguity that must be discussed with the user.

Commit each meaningful completed task before moving to the next meaningful task.
Use Conventional Commits.
Before each commit, run relevant verification, inspect the diff, and ensure no secrets, uploaded archives, private source, extracted source, or local env files are included.
```

## Approval Checklist

Before running the generation prompt, confirm:

- product direction is approved;
- documentation language is English;
- implementation should start now;
- OpenAI-compatible provider is acceptable for first AI adapter;
- initial UI stack choice is approved;
- upload limits are acceptable or can use documented defaults.
