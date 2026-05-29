# Git Workflow

## Branches

- Branch from `main`.
- Use focused branches.
- Do not commit directly to `main` unless explicitly requested.

Suggested names:

```text
feat/monorepo-foundation
feat/source-loader
feat/documentation-generator
fix/archive-path-traversal
docs/product-spec
```

## Commits

Use Conventional Commits:

```text
<type>(<scope>): <short imperative summary>

- short detail
- short detail
```

Allowed types:

```text
feat
fix
chore
refactor
style
docs
test
perf
ci
build
```

## Before Commit

Run:

```bash
git status
git diff
```

Check:

- only related files are included;
- no archives with private code are included;
- no extracted source fixtures from real projects are included;
- no `.env` secrets are included;
- relevant verification was run;
- docs were updated if needed.

## Pull Requests

Each PR should explain:

- what changed;
- why it changed;
- how it was tested;
- risks and follow-ups.
