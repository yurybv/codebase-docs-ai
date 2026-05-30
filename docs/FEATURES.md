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
- Expose terminal run duration metadata in run summaries.
- Sort documentation run summaries by create, completion, or update time.
- Filter documentation run summaries by created-at range.
- Filter documentation run summaries by completed-at range.
- Filter documentation run summaries by updated-at range.
- Filter documentation run summaries by run name.
- Filter documentation run summaries by output format.
- Filter documentation run summaries by source count.
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
- Run history sort direction.
- Run history created-at range filters.
- Run history completed-at range filters.
- Run history updated-at range filters.
- Run history name search.
- Run history output-format filtering.
- Run history source-count filtering.
- Run history terminal duration display.
- Run progress display.
- Warnings display.
- Page preview.
- Download controls.

## SDK Features

- HTTP client.
- Typed requests/responses.
- Run listing helper.
- Paginated run listing helper.
- Terminal run duration metadata in listed summaries.
- Sorted run listing helper.
- Created-at filtered run listing helper.
- Completed-at filtered run listing helper.
- Updated-at filtered run listing helper.
- Name-filtered run listing helper.
- Output-format filtered run listing helper.
- Source-count filtered run listing helper.
- Upload helper.
- Polling helper.
- Result retrieval helper.
- Download helper.

## CLI Features

- Generate docs from archives.
- Generate docs from local folders.
- List API-backed run summaries.
- Limit API-backed run summaries.
- Sort API-backed run summaries.
- Filter API-backed run summaries by status.
- Filter API-backed run summaries by source role.
- Filter API-backed run summaries by created-at range.
- Filter API-backed run summaries by completed-at range.
- Filter API-backed run summaries by updated-at range.
- Filter API-backed run summaries by run name.
- Filter API-backed run summaries by output format.
- Filter API-backed run summaries by source count.
- Paginate API-backed run summaries.
- Show terminal run duration metadata in API-backed run summaries.
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
