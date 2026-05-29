# Architecture

## Architecture Principle

`codebase-docs-ai` is a documentation engine with multiple delivery surfaces.

The core engine owns the product value. UI, API, CLI, and SDK are adapters around it.

```text
Web UI        -> API -> Core Engine
External app  -> API -> Core Engine
Node.js SDK   -> API or Core Engine
CLI           -> Core Engine
```

## Main Layers

### 1. Source Layer

Accepts and normalizes source inputs.

Responsibilities:

- receive archive buffers or local folder paths;
- validate input metadata;
- safely extract archives;
- prevent path traversal;
- enforce file count and size limits;
- build a normalized file inventory.

Package:

```text
packages/source-loader
```

### 2. Security Layer

Protects source content before analysis and AI usage.

Responsibilities:

- denylist risky files;
- skip generated and binary files;
- detect likely secrets;
- redact secret values;
- record redaction counts;
- prevent unsafe prompt context.

Package:

```text
packages/security
```

### 3. Repository Analyzer Layer

Analyzes each source input independently.

Responsibilities:

- detect framework and runtime;
- parse package metadata;
- detect scripts;
- find frontend routes;
- find backend routes/controllers;
- detect API clients;
- detect environment variables;
- detect tests, CI, Docker, database files;
- produce a `RepositoryMap`.

Package:

```text
packages/repo-analyzer
```

### 4. System Analyzer Layer

Correlates multiple `RepositoryMap` objects into one system view.

Responsibilities:

- match frontend API calls with backend routes;
- identify source relationships;
- infer auth flow from evidence;
- connect environment variables across sources;
- detect missing or uncertain contracts;
- produce a `SystemMap`.

Package:

```text
packages/system-analyzer
```

### 5. AI Orchestration Layer

Owns AI provider abstraction and prompt execution.

Responsibilities:

- provider adapters;
- prompt templates;
- structured output validation;
- token budgeting;
- retries for transient AI failures;
- prompt safety checks.

Package:

```text
packages/ai-orchestrator
```

### 6. Documentation Generator Layer

Turns maps into documentation pages.

Responsibilities:

- create documentation plan;
- generate page content;
- validate page structure;
- attach source references;
- attach warnings and unknowns;
- produce `DocumentationTree`.

Package:

```text
packages/documentation-generator
```

### 7. Renderer Layer

Converts `DocumentationTree` into user-facing artifacts.

Responsibilities:

- render Markdown tree;
- render single Markdown;
- render JSON;
- produce downloadable zip;
- future HTML and Confluence renderers.

Package:

```text
packages/renderers
```

## Applications

### API

```text
apps/api
```

NestJS application exposing documentation generation over HTTP.

The API should start simple:

- multipart upload;
- run creation;
- status polling;
- result retrieval;
- download endpoint.

It can run generation in-process first. Worker extraction can be added later without changing the API contract.

Run metadata and generated artifacts are retained under the configured temporary root:

```text
DOCS_AI_TMP_DIR
```

Default:

```text
.tmp/codebase-docs-ai
```

Each run stores a manifest and rendered result artifacts on disk so a process-local service restart can still read completed run results while the temporary directory exists.

The API service exposes an internal cleanup boundary for removing expired run directories. The default run retention window is 24 hours and can be configured with:

```text
DOCS_AI_RUN_RETENTION_MS
```

### Web

```text
apps/web
```

Simple operator UI for product testing:

- upload archives;
- assign source roles;
- start run;
- preview result;
- download docs.

### CLI

```text
apps/cli
```

Local command-line wrapper around the core engine.

## Core Engine

```text
packages/core
```

The core engine is the shared orchestration boundary used by API and CLI.

Responsibilities:

- accept already loaded sources;
- apply security filtering;
- run per-source repository analysis;
- run cross-source system analysis;
- generate the documentation tree;
- render requested output formats.

Transport-specific concerns remain outside the core engine:

- API owns uploads, run lifecycle state, and HTTP downloads;
- CLI owns local path parsing and writing files to disk;
- SDK owns HTTP client ergonomics.

## Data Flow

```text
Archive Upload / Local Path
  -> Adapter stores or resolves input
  -> Source Loader extracts safely
  -> Core Engine
      -> Security filters and redacts
      -> Repo Analyzer builds RepositoryMap per source
      -> System Analyzer builds SystemMap
      -> Documentation Generator creates DocumentationTree
      -> Renderers produce output files
  -> Adapter returns, downloads, or writes artifacts
```

## Stable Internal Contracts

The engine should be designed around stable contracts:

- `SourceInput`
- `LoadedSource`
- `RepositoryMap`
- `SystemMap`
- `DocumentationTree`
- `RenderedDocumentation`
- `DocumentationRun`

These contracts should live in:

```text
packages/shared
```

## External Integration Contract

The universal integration surface is HTTP.

Any external project can call the module with:

```text
POST /v1/documentation-runs
POST /v1/documentation-runs/:runId/sources
POST /v1/documentation-runs/:runId/start
GET /v1/documentation-runs/:runId/result
GET /v1/documentation-runs/:runId/download
```

The Node.js SDK is a convenience layer, not the only integration path.

## Future Extension Points

Add future integrations as adapters:

- GitHub source adapter;
- GitLab source adapter;
- Confluence publisher;
- Notion publisher;
- persistent storage;
- background worker;
- scheduled runs.

Adapters must not bypass source loading, security filtering, or structured maps.
