# External Rule Sources

This document records which external project docs were reviewed and what should be adapted into `codebase-docs-ai`.

## project-rule-templates

Location:

```text
/Users/yurybogdanov/Projects/project-rule-templates
```

Useful files:

- `react-nest/AGENTS.md`
- `react-nest/docs/DEVELOPMENT_WORKFLOW.md`
- `react-nest/docs/GIT_WORKFLOW.md`
- `react-nest/docs/SECURITY.md`
- `react-nest/docs/TESTING.md`
- `react-nest/docs/CODING_STANDARDS.md`
- `react-nest/docs/CODE_REVIEW.md`
- `react-nest/docs/ENVIRONMENT.md`
- `react-nest/.github/PULL_REQUEST_TEMPLATE.md`

Useful script:

```text
scripts/apply-react-nest-rules.sh
```

Script behavior:

- copies rule docs into a target project;
- keeps existing files;
- writes `.template` files when target files already exist.

Recommendation:

- Do not run the script blindly for this project.
- The template assumes a generic React + Nest product.
- Adapt the rules manually around the documentation engine architecture.

What was adapted:

- inspect-first workflow;
- focused changes;
- docs updates;
- TypeScript/Nest/React baseline;
- security and testing checklists;
- conventional commit guidance.

What should not be copied directly:

- frontend/backend-only architecture assumptions;
- generic env vars such as `JWT_SECRET` unless later needed;
- UI-heavy rules before the core engine exists.

## ECC

Location:

```text
/Users/yurybogdanov/Projects/ECC
```

Useful files reviewed:

- `RULES.md`
- `AGENTS.md`
- `.cursor/rules/common-development-workflow.md`
- `.cursor/rules/common-git-workflow.md`
- `.cursor/rules/common-coding-style.md`
- `.cursor/rules/common-security.md`
- `.cursor/rules/common-testing.md`
- `.cursor/rules/typescript-coding-style.md`
- `.cursor/rules/typescript-patterns.md`
- `.cursor/rules/typescript-security.md`
- `.cursor/rules/typescript-testing.md`
- `.github/prompts/plan.prompt.md`
- `.github/prompts/code-review.prompt.md`
- `.opencode/commands/update-docs.md`

Useful ideas:

- plan before complex work;
- use TDD for risky logic;
- review security first;
- keep files small and cohesive;
- validate all boundaries;
- avoid hardcoded secrets;
- keep documentation synchronized with implementation;
- produce structured plans and done criteria.

What should not be copied directly:

- ECC-specific agent orchestration references;
- harness/plugin installation details;
- broad 80% coverage rule as a blocker for every task;
- language ecosystems unrelated to TypeScript/Nest/React;
- commands that assume ECC runtime.

How to use ECC going forward:

- Treat ECC as a source of development discipline and prompt patterns.
- Rewrite any borrowed workflow into project-specific docs.
- Keep all final project docs in English.
