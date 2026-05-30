# API Contract

## Goal

The API is the universal integration surface for any external system, regardless of programming language.

It accepts source archives and returns generated documentation artifacts.

## Base Path

```text
/v1
```

## Run Lifecycle

```text
created
uploading_sources
ready
running
extracting_sources
analyzing_sources
building_system_map
generating_documentation
rendering_output
completed
failed
cancelled
expired
```

## Create Run

```http
POST /v1/documentation-runs
Content-Type: application/json
```

Request:

```json
{
  "name": "Customer Portal Documentation",
  "options": {
    "outputFormats": ["markdown-tree", "single-markdown", "json"],
    "language": "en",
    "includeSourceReferences": true,
    "includeWarnings": true
  }
}
```

Response:

```json
{
  "runId": "run_123",
  "status": "created"
}
```

## List Runs

```http
GET /v1/documentation-runs?limit=50&status=completed&role=backend
```

Returns persisted run summaries for operator surfaces, sorted by `updatedAt` descending. Deleted and expired-cleaned runs are omitted.

Query:

- `limit`: optional integer from `1` to `100`;
- default: `50`;
- invalid limit values return `RUN_LIST_LIMIT_INVALID`;
- `status`: optional `DocumentationRunStatus` filter;
- invalid status values return `RUN_LIST_STATUS_INVALID`;
- `role`: optional source role filter. Runs match when at least one uploaded source has this role;
- invalid role values return `RUN_LIST_SOURCE_ROLE_INVALID`.

Response:

```json
{
  "runs": [
    {
      "id": "run_123",
      "name": "Customer Portal Documentation",
      "status": "completed",
      "sources": [
        {
          "name": "Frontend",
          "role": "frontend"
        }
      ],
      "sourceCount": 1,
      "outputFormats": ["single-markdown", "json"],
      "renderedFormats": ["single-markdown", "json"],
      "progress": {
        "currentStep": "Documentation run completed",
        "completedSteps": 7,
        "totalSteps": 7
      },
      "createdAt": "2026-05-30T00:00:00.000Z",
      "updatedAt": "2026-05-30T00:01:00.000Z"
    }
  ]
}
```

Run summaries must not expose upload archive storage paths, extracted source paths, result artifact paths, raw source content, or secret-bearing evidence.

## Upload Sources

```http
POST /v1/documentation-runs/:runId/sources
Content-Type: multipart/form-data
```

Parts:

```text
metadata: JSON
files: one or more archives
```

Supported archive file names:

```text
.zip
.tar
.tar.gz
.tgz
```

Unsupported file names are rejected before the API stores upload artifacts.

Metadata:

```json
{
  "sources": [
    {
      "fileField": "frontend",
      "name": "Frontend",
      "role": "frontend"
    },
    {
      "fileField": "backend",
      "name": "Backend",
      "role": "backend"
    }
  ]
}
```

Response:

```json
{
  "runId": "run_123",
  "status": "ready",
  "sources": [
    {
      "sourceId": "src_frontend",
      "name": "Frontend",
      "role": "frontend",
      "fileName": "frontend.zip"
    }
  ]
}
```

## Start Run

```http
POST /v1/documentation-runs/:runId/start
```

Response:

```json
{
  "runId": "run_123",
  "status": "running"
}
```

## Get Run

```http
GET /v1/documentation-runs/:runId
```

Response:

```json
{
  "runId": "run_123",
  "status": "generating_documentation",
  "progress": {
    "currentStep": "Generating API Contracts page",
    "completedSteps": 6,
    "totalSteps": 9
  }
}
```

Completed runs include the formats that were actually rendered and can be downloaded:

```json
{
  "runId": "run_123",
  "status": "completed",
  "renderedFormats": ["single-markdown", "json"],
  "progress": {
    "currentStep": "Documentation run completed",
    "completedSteps": 7,
    "totalSteps": 7
  }
}
```

If a run fails, the persisted run state includes a safe error summary:

```json
{
  "runId": "run_123",
  "status": "failed",
  "progress": {
    "currentStep": "Failed",
    "completedSteps": 2,
    "totalSteps": 7
  },
  "error": {
    "message": "Documentation generation failed."
  }
}
```

## Get Result

```http
GET /v1/documentation-runs/:runId/result
```

Response:

```json
{
  "runId": "run_123",
  "status": "completed",
  "renderedFormats": ["single-markdown", "json"],
  "documentation": {
    "title": "Customer Portal Documentation",
    "pages": [
      {
        "key": "overview",
        "title": "01. Overview",
        "markdown": "# 01. Overview\n..."
      }
    ],
    "warnings": []
  }
}
```

If the run manifest exists but its persisted result artifact is no longer available, the API returns a safe error envelope with:

```text
DOCUMENTATION_RESULT_ARTIFACT_MISSING
```

## Download Result

```http
GET /v1/documentation-runs/:runId/download?format=markdown-tree
```

Supported formats:

```text
markdown-tree
single-markdown
json
```

Use `renderedFormats` from `GET /v1/documentation-runs/:runId` or `/result` to discover which of these formats are available for a specific completed run.

If the run manifest exists but a persisted rendered artifact is no longer available, the API returns a safe error envelope with:

```text
DOCUMENTATION_DOWNLOAD_ARTIFACT_MISSING
```

## Delete Run

```http
DELETE /v1/documentation-runs/:runId
```

Deletes temporary files and run artifacts.

## Error Response

All non-2xx JSON API errors use the same envelope:

```json
{
  "error": {
    "code": "SOURCE_ARCHIVE_INVALID",
    "message": "The uploaded archive could not be extracted safely.",
    "suggestion": "Upload a valid .zip, .tar, .tar.gz, or .tgz archive."
  }
}
```

Fields:

- `error.code`: stable machine-readable error code;
- `error.message`: safe human-readable summary;
- `error.details`: optional validation details;
- `error.suggestion`: optional remediation hint.

The API must not return raw server paths, internal stack traces, uploaded source content, or prompt payloads inside error responses.

The SDK exposes this envelope through `CodebaseDocsAIClientError.status`, `CodebaseDocsAIClientError.code`, and `CodebaseDocsAIClientError.details`.

## API Rules

- Validate all request bodies.
- Validate all uploaded files.
- Never return raw server paths.
- Never expose internal stack traces.
- Never log uploaded source content by default.
- Enforce upload size limits.
- Enforce run artifact retention.

## Upload Limits

Multipart source uploads are limited before archive extraction.

Runtime configuration:

```text
DOCS_AI_UPLOAD_MAX_FILES
DOCS_AI_UPLOAD_MAX_FILE_SIZE_BYTES
```

Defaults:

```text
DOCS_AI_UPLOAD_MAX_FILES=5
DOCS_AI_UPLOAD_MAX_FILE_SIZE_BYTES=104857600
```
