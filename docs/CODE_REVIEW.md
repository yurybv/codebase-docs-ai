# Code Review

## Review Priorities

Review in this order:

1. Security and private source handling.
2. Correctness and regressions.
3. Archive extraction safety.
4. Input validation.
5. Error handling.
6. Test coverage.
7. Package boundary integrity.
8. Maintainability.

## Severity

- `CRITICAL`: secret leak, path traversal, unsafe archive extraction, prompt leakage, data loss.
- `HIGH`: likely production bug, broken API contract, unsafe file handling.
- `MEDIUM`: missing edge case, weak tests, maintainability issue.
- `LOW`: naming, style, small cleanup.

## Checklist

- [ ] Requirement is implemented.
- [ ] Uploaded archives are treated as untrusted.
- [ ] Source filters and redaction run before AI usage.
- [ ] API validates request bodies and files.
- [ ] Errors are safe for users.
- [ ] No secrets or private source are logged.
- [ ] Tests cover new behavior.
- [ ] Package boundaries are respected.
- [ ] Documentation is updated if needed.
- [ ] Diff contains no unrelated changes.
