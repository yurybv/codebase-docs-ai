# Product Features

This document tracks the product capabilities that must exist in the generated project.

## Core Input Features

- Upload one source archive.
- Upload multiple source archives.
- Assign roles to sources:
  - frontend
  - backend
  - shared
  - infra
  - mobile
  - docs
  - unknown
- Load local folder sources through CLI or local engine mode.
- Validate archive type.
- Reject unsafe archive paths.
- Enforce archive and file limits.

## Source Analysis Features

- Build file inventory.
- Skip binary/generated files.
- Apply denylist.
- Redact secrets.
- Detect package manager.
- Detect language/runtime/framework.
- Extract package scripts.
- Extract dependencies.
- Detect frontend routes.
- Detect backend routes/controllers.
- Detect API client calls.
- Detect environment variable names.
- Detect Docker/CI/database files.
- Produce `RepositoryMap`.

## System Analysis Features

- Correlate multiple repositories/sources.
- Match frontend API calls to backend routes.
- Report unmatched frontend calls.
- Report unmatched backend routes.
- Detect probable auth flow.
- Detect environment variable relationships.
- Detect external integrations.
- Produce `SystemMap`.

## Documentation Generation Features

- Generate documentation plan.
- Generate documentation pages:
  - Overview
  - System Architecture
  - Source Inventory
  - Frontend
  - Backend
  - API Contracts
  - Authentication and Authorization
  - Environment Variables
  - Local Development
  - Testing
  - Build and Deployment
  - External Integrations
  - Risks and Unknowns
  - Source References
- Include source references.
- Include warnings and unknowns.
- Validate AI output.
- Produce `DocumentationTree`.

## Output Features

- Render markdown tree.
- Render single markdown file.
- Render JSON result.
- Package markdown tree as zip.
- Provide preview-friendly page list.

## API Features

- Create documentation run.
- List documentation run summaries.
- Paginate documentation run summaries.
- Upload sources.
- Start run.
- Get run status.
- Get JSON result.
- Download rendered result.
- Delete run and temporary artifacts.

## UI Features

- Archive upload form.
- Source role selection.
- Output format selection.
- Run history refresh.
- Run history pagination.
- Run progress display.
- Warnings display.
- Page preview.
- Download controls.

## SDK Features

- HTTP client.
- Typed requests/responses.
- Run listing helper.
- Paginated run listing helper.
- Upload helper.
- Polling helper.
- Result retrieval helper.
- Download helper.

## CLI Features

- Generate docs from archives.
- Generate docs from local folders.
- List API-backed run summaries.
- Limit API-backed run summaries.
- Filter API-backed run summaries by status.
- Filter API-backed run summaries by source role.
- Paginate API-backed run summaries.
- Select output format.
- Write output to local folder.

## Future Adapter Features

- GitHub source adapter.
- GitLab source adapter.
- Confluence publisher.
- Notion publisher.
- HTML renderer.
- Persistent projects.
- Queued background workers.
- Scheduled regeneration.
