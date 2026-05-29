# Codebase Docs AI Product Specification

## 1. Product Definition

`codebase-docs-ai` is a reusable documentation engine that accepts one or more source-code inputs, analyzes them as a single software system, and generates structured technical documentation.

The product must work without requiring GitHub, Confluence, Jira, or any other external integration. Integrations can be added later as adapters, but the core product is:

```text
source code input -> deterministic analysis -> AI-assisted documentation -> structured documentation output
```

The primary input is an uploaded archive or local folder. The primary output is a documentation tree that can be rendered as Markdown files, a single Markdown document, JSON, or future formats such as HTML and Confluence storage format.

## 2. Core Goal

The module must allow another product, service, or user interface to provide source code and receive high-quality technical documentation.

It must support:

- one archive or folder;
- multiple archives or folders representing one system;
- frontend and backend repositories analyzed together;
- shared, infra, mobile, or unknown source roles;
- deterministic source scanning before AI usage;
- secret redaction before AI prompts;
- structured documentation pages;
- API usage from any programming language;
- SDK usage from Node.js / TypeScript projects;
- UI usage for manual testing and operator workflows.

## 3. Non-Negotiable Product Shape

The system must be built as an external module, not as a one-off UI application.

The module has four access surfaces:

```text
Core Engine
  - pure TypeScript package used by all other surfaces

HTTP API
  - universal integration surface for any language or host system

Node.js SDK
  - convenient TypeScript client for Node.js projects

Web UI
  - simple operator UI for uploading archives, testing runs, previewing docs, and downloading output
```

The Web UI must not contain core analysis or generation logic. It only talks to the API.

## 4. Product Workflow

### 4.1 Manual UI Workflow

```text
1. User opens the Web UI.
2. User uploads one or more archives.
3. User assigns a role to each input:
   - frontend
   - backend
   - shared
   - infra
   - mobile
   - docs
   - unknown
4. User chooses output options:
   - markdown tree
   - single markdown
   - JSON
5. User starts documentation generation.
6. System extracts and analyzes each source input.
7. System correlates inputs into one system map.
8. System generates documentation pages.
9. User previews pages and warnings.
10. User downloads the result.
```

### 4.2 API Workflow

```text
1. Host application creates a documentation run.
2. Host application uploads source archives and metadata.
3. Host application polls run status or subscribes to events.
4. Host application downloads the documentation result.
5. Host application decides what to do with the output.
```

### 4.3 SDK Workflow

```ts
const result = await client.documentation.generate({
  sources: [
    {
      name: 'frontend',
      role: 'frontend',
      archive: frontendArchive,
    },
    {
      name: 'backend',
      role: 'backend',
      archive: backendArchive,
    },
  ],
  output: {
    formats: ['markdown-tree', 'single-markdown', 'json'],
  },
});
```

## 5. Source Inputs

The first-class input types are:

- `.zip` archive;
- `.tar`;
- `.tar.gz`;
- local folder path for CLI/internal SDK usage.

Future adapters may provide source inputs from:

- GitHub;
- GitLab;
- Bitbucket;
- S3-compatible object storage;
- internal artifact storage.

These adapters must remain outside the core engine.

## 6. Source Role Model

Each source input must have a name and role.

```ts
export type SourceRole =
  | 'frontend'
  | 'backend'
  | 'shared'
  | 'infra'
  | 'mobile'
  | 'docs'
  | 'unknown';

export interface SourceInput {
  id?: string;
  name: string;
  role: SourceRole;
  archive?: Buffer;
  folderPath?: string;
  metadata?: Record<string, unknown>;
}
```

The role is a hint, not an absolute truth. The analyzer may detect that an input marked as `unknown` is a Next.js frontend or NestJS backend.

## 7. Analysis Pipeline

The documentation engine must follow this pipeline:

```text
Source Input
  -> safe extraction
  -> file inventory
  -> file filtering
  -> secret scanning and redaction
  -> per-source analysis
  -> system-level correlation
  -> documentation plan
  -> page generation
  -> validation
  -> rendering
  -> result package
```

AI must not receive raw archives blindly. The engine must create deterministic maps first, then pass controlled context to the AI layer.

## 8. Per-Source Analysis

The per-source analyzer produces a `RepositoryMap` for each uploaded archive/folder.

It must detect:

- package manager;
- runtime;
- framework;
- language;
- build scripts;
- start scripts;
- test scripts;
- lint/typecheck scripts;
- main directories;
- entry points;
- frontend routes;
- backend routes/controllers;
- API clients;
- environment variable names;
- CI/CD files;
- Docker files;
- database/schema files;
- dependencies;
- external service usage;
- auth-related files;
- generated, binary, and ignored files;
- risks and unknowns.

Initial framework focus:

- TypeScript;
- React;
- Next.js;
- NestJS;
- Node.js packages.

The design must allow other language analyzers later.

## 9. System-Level Analysis

The system analyzer receives all `RepositoryMap` objects and produces a `SystemMap`.

It must identify:

- which source is frontend/backend/shared/infra;
- frontend calls to backend APIs;
- backend endpoints and controllers;
- possible matches between frontend API calls and backend routes;
- missing or unmatched API contracts;
- shared DTO/type usage;
- auth flow across frontend and backend;
- environment variable relationships;
- deployment/runtime assumptions;
- external integrations used by the whole system;
- source-level risks and cross-source risks;
- confidence levels and unknowns.

Example:

```ts
export interface SystemMap {
  sources: RepositoryMap[];
  relationships: SourceRelationship[];
  apiContracts: ApiContract[];
  authFlows: AuthFlow[];
  environmentLinks: EnvironmentLink[];
  integrations: IntegrationPoint[];
  risks: SystemRisk[];
  unknowns: SystemUnknown[];
}
```

## 10. Documentation Output

The canonical internal output is a `DocumentationTree`.

```ts
export interface DocumentationTree {
  title: string;
  summary: string;
  pages: DocumentationPage[];
  warnings: DocumentationWarning[];
  sourceReferences: SourceReference[];
  generatedAt: string;
}

export interface DocumentationPage {
  key: string;
  title: string;
  order: number;
  markdown: string;
  sourceReferences: SourceReference[];
  warnings: DocumentationWarning[];
}
```

Renderers convert this tree into:

- markdown tree zip;
- single markdown document;
- JSON;
- future HTML;
- future Confluence storage format.

## 11. Default Documentation Tree

For a multi-source system, generate:

```text
01. Overview
02. System Architecture
03. Source Inventory
04. Frontend
05. Backend
06. API Contracts
07. Authentication and Authorization
08. Environment Variables
09. Local Development
10. Testing
11. Build and Deployment
12. External Integrations
13. Risks and Unknowns
14. Source References
```

If a source type is missing, the corresponding page should explain that the input did not contain enough evidence.

## 12. AI Responsibilities

AI should be used for:

- turning structured maps into readable documentation;
- explaining architecture and relationships;
- summarizing source responsibilities;
- describing onboarding steps from detected scripts;
- writing practical developer-facing pages;
- identifying documentation gaps from provided evidence.

AI must not be used for:

- reading raw archives directly;
- receiving secrets;
- guessing infrastructure details without evidence;
- publishing anywhere;
- making irreversible changes;
- deciding security permissions.

AI output must be schema-validated.

## 13. Security Requirements

The product processes private source code, so security is a core feature.

Mandatory rules:

- extract archives safely;
- prevent path traversal during extraction;
- enforce archive size limits;
- enforce file count limits;
- skip binary and generated files;
- denylist secret files;
- redact secrets before AI prompts;
- never log raw source by default;
- never log secrets or full AI prompts containing source;
- store uploaded archives only as long as needed;
- make retention configurable.

Never send these files to AI:

```text
.env
.env.*
*.pem
*.key
*.p12
*.pfx
id_rsa
id_ed25519
secrets.*
credentials.*
node_modules/**
dist/**
build/**
.next/**
coverage/**
.git/**
```

## 14. Backend Requirements

The backend should be simple but production-shaped.

Recommended stack:

- Node.js;
- TypeScript;
- NestJS;
- REST API;
- local filesystem storage for early runs;
- PostgreSQL optional for persisted runs;
- Redis/BullMQ optional when long-running background processing is needed.

The first backend can run jobs in-process, but the architecture must allow moving generation to a worker later.

## 15. API Contract

Required endpoints:

```text
POST /v1/documentation-runs
GET /v1/documentation-runs/:runId
POST /v1/documentation-runs/:runId/sources
POST /v1/documentation-runs/:runId/start
GET /v1/documentation-runs/:runId/result
GET /v1/documentation-runs/:runId/download
DELETE /v1/documentation-runs/:runId
```

The API must support multipart archive upload with source metadata.

## 16. UI Requirements

The UI is a simple testing and operator surface.

It must support:

- upload one or multiple archives;
- assign source roles;
- configure output format;
- start generation;
- show run progress;
- show warnings;
- preview generated pages;
- download documentation output.

The UI should not require user authentication for local development. Production deployments can add auth later.

## 17. SDK Requirements

The Node.js SDK must support two modes:

1. HTTP client mode, calling the service API.
2. Optional local engine mode, using the core package directly.

The HTTP mode is the stable external integration surface.

## 18. CLI Requirements

The CLI is useful for local development and automation.

Example:

```bash
codebase-docs-ai generate \
  --source frontend.zip:frontend \
  --source backend.zip:backend \
  --output ./generated-docs \
  --format markdown-tree
```

The CLI should call the same core engine as the API.

## 19. Package Architecture

Recommended monorepo:

```text
codebase-docs-ai/
  apps/
    api/
    web/
    cli/
  packages/
    core/
    source-loader/
    repo-analyzer/
    system-analyzer/
    ai-orchestrator/
    documentation-generator/
    renderers/
    security/
    sdk/
    shared/
  docs/
  examples/
  package.json
  pnpm-workspace.yaml
  turbo.json
```

## 20. Completion Definition For Product Generation

The initial product generation is complete when:

- repository is a working pnpm monorepo;
- API starts locally;
- UI starts locally;
- CLI can run locally;
- SDK package exposes documented methods;
- user can upload frontend/backend archives in UI;
- API can accept archives and return a documentation result;
- engine safely extracts and analyzes archives;
- engine generates a multi-page documentation tree;
- output can be downloaded as Markdown;
- docs explain architecture, API, SDK, security, testing, and workflow;
- tests cover source loading, filtering, redaction, analysis, rendering, and API basics.

## 21. Future Adapters

After the core product works, add adapters:

- GitHub source adapter;
- GitLab source adapter;
- Confluence publisher;
- Notion publisher;
- static HTML renderer;
- persistent project/workspace management;
- queued background workers;
- scheduled rescans.

These must not change the core engine contract.
