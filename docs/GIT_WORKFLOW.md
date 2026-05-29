# Git Workflow

## Branches

- Work directly on `master`.
- Do not create feature branches for autonomous development unless the user explicitly asks for a branch.
- Commit each meaningful completed task directly to `master`.
- Keep commits focused and reviewable even without branch separation.

The user explicitly requested this repository workflow after the initial feature branch was merged into `master`.

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

Pull requests are not required for the default local autonomous workflow. If the user asks for a PR, it should explain:

- what changed;
- why it changed;
- how it was tested;
- risks and follow-ups.
