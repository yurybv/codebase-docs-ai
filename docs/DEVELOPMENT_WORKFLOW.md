# Development Workflow

This workflow adapts useful ideas from `project-rule-templates` and ECC:

- inspect first;
- plan non-trivial work;
- write tests around risky behavior;
- keep changes focused;
- verify before finishing;
- update durable docs.

## Default Flow

1. Read current project docs:
   - `README.md`
   - `codebase-docs-ai-project-documentation.md`
   - `docs/STATE.md`
   - relevant architecture/API/security/testing docs
2. Identify the current implementation phase.
3. Inspect existing code before editing.
4. For non-trivial work, write a short implementation plan.
5. Add or update tests.
6. Implement the smallest coherent product slice.
7. Run relevant checks.
8. Review the diff for secrets, unrelated changes, and architecture drift.
9. Update `docs/STATE.md`.

## Implementation Order

Build the product in this order:

1. Monorepo foundation.
2. Shared types and contracts.
3. Source loader.
4. Security filtering and redaction.
5. Per-source analyzer.
6. System analyzer.
7. Documentation generator.
8. Markdown and JSON renderers.
9. API.
10. Web UI.
11. SDK.
12. CLI.

## Planning Required Before

Plan before changing:

- source extraction;
- security filtering;
- AI prompt construction;
- API contracts;
- shared type contracts;
- renderer output formats;
- multi-package architecture;
- storage/retention behavior.

## Definition Of Done

A task is done when:

- behavior is implemented;
- tests cover relevant logic;
- lint/typecheck/build pass when available;
- no private archives or generated extracted source are committed;
- docs are updated when durable knowledge changed;
- `docs/STATE.md` reflects what changed and what remains.

## Verification Strategy

Use the narrowest useful check first:

```bash
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

When scripts do not exist yet, create them during monorepo setup.
