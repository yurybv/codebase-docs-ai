import type {
  DocumentationOutputFormat,
  DocumentationRunListResponse,
  DocumentationRun,
  DocumentationRunOptions,
  DocumentationRunStatus,
  DocumentationTree,
  SourceInputMetadata,
  SourceRole
} from '@codebase-docs-ai/shared';

export interface CodebaseDocsAIClientConfig {
  apiBaseUrl: string;
  fetch?: typeof fetch;
}

export interface CreateDocumentationRunInput {
  name: string;
  options: DocumentationRunOptions;
}

export interface CreateDocumentationRunResponse {
  runId: string;
  status: DocumentationRunStatus;
}

export interface UploadDocumentationSourceInput {
  name: string;
  role: SourceRole;
  file: Blob;
  fileName: string;
}

export interface UploadDocumentationSourcesResponse {
  runId: string;
  status: DocumentationRunStatus;
  sources: SourceInputMetadata[];
}

export interface DocumentationRunResult {
  runId: string;
  status: DocumentationRunStatus;
  renderedFormats: DocumentationOutputFormat[];
  documentation: DocumentationTree;
}

export interface DownloadDocumentationInput {
  runId: string;
  format: DocumentationOutputFormat;
}

export interface DownloadDocumentationResult {
  fileName: string | null;
  contentType: string | null;
  content: Blob;
}

export interface PollDocumentationRunOptions {
  intervalMs?: number;
  timeoutMs?: number;
}

export interface DocumentationRunListOptions {
  limit?: number;
}

export interface GenerateFromArchivesInput {
  name: string;
  options: DocumentationRunOptions;
  sources: UploadDocumentationSourceInput[];
  poll?: PollDocumentationRunOptions;
  downloadFormat?: DocumentationOutputFormat;
}

export interface GenerateFromArchivesResult {
  run: DocumentationRun;
  result: DocumentationRunResult;
  download?: DownloadDocumentationResult;
}

export interface DocumentationRunsClient {
  create(input: CreateDocumentationRunInput): Promise<CreateDocumentationRunResponse>;
  list(options?: DocumentationRunListOptions): Promise<DocumentationRunListResponse>;
  uploadSources(
    runId: string,
    sources: UploadDocumentationSourceInput[]
  ): Promise<UploadDocumentationSourcesResponse>;
  start(runId: string): Promise<CreateDocumentationRunResponse>;
  get(runId: string): Promise<DocumentationRun>;
  waitUntilComplete(runId: string, options?: PollDocumentationRunOptions): Promise<DocumentationRun>;
  getResult(runId: string): Promise<DocumentationRunResult>;
  download(input: DownloadDocumentationInput): Promise<DownloadDocumentationResult>;
  generateFromArchives(input: GenerateFromArchivesInput): Promise<GenerateFromArchivesResult>;
  delete(runId: string): Promise<{ runId: string; deleted: boolean }>;
}
