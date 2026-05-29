# Coding Standards

## General

- Prefer simple, readable code.
- Follow local package boundaries.
- Keep functions focused.
- Keep files cohesive.
- Avoid speculative abstractions.
- Use explicit types at package boundaries.
- Use schema validation for untrusted input.
- Handle errors explicitly.
- Remove unused code.

## TypeScript

- Avoid `any`.
- Use `unknown` at untrusted boundaries and narrow it.
- Export shared contracts from `packages/shared`.
- Prefer discriminated unions for result states.
- Do not suppress TypeScript errors without a documented reason.

## Package Boundaries

- UI must not implement engine logic.
- API controllers must not implement engine logic.
- Source loading must not call AI.
- Security filtering must happen before prompt creation.
- Renderers consume `DocumentationTree`; they do not analyze source.

## Error Handling

- Return safe messages from API.
- Preserve internal error context in server logs without secrets.
- Do not silently swallow failures.
- Use typed error codes for user-facing API responses.

## File Size Guidance

- 200-400 lines is a healthy target.
- Around 800 lines should trigger a split unless there is a clear reason.
- Split by responsibility, not mechanically by file type.
