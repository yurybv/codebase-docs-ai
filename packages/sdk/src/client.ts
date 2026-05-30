import {
  type ApiErrorPayload,
  type DocumentationRun,
  type DocumentationOutputFormat,
  type DocumentationRunListResponse,
  type DocumentationRunStatus,
  type DocumentationRunSummary,
  type SourceRole,
  documentationOutputFormatSchema,
  isSupportedSourceArchiveFileName,
  maxDocumentationRunListLimit,
  sanitizePublicErrorText,
  sanitizePublicErrorValue,
  sourceRoles,
  supportedSourceArchiveExtensions
} from '@codebase-docs-ai/shared';
import type {
  CodebaseDocsAIClientConfig,
  CreateDocumentationRunInput,
  CreateDocumentationRunResponse,
  DocumentationRunListOptions,
  GenerateFromArchivesInput,
  GenerateFromArchivesResult,
  DocumentationRunResult,
  DocumentationRunsClient,
  DownloadDocumentationInput,
  DownloadDocumentationResult,
  PollDocumentationRunOptions,
  UploadDocumentationSourceInput,
  UploadDocumentationSourcesResponse
} from './sdk-types.js';

export class CodebaseDocsAIClient {
  readonly documentationRuns: DocumentationRunsClient;

  constructor(config: CodebaseDocsAIClientConfig) {
    const http = new HttpClient(config);
    this.documentationRuns = new HttpDocumentationRunsClient(http);
  }
}

class HttpDocumentationRunsClient implements DocumentationRunsClient {
  constructor(private readonly http: HttpClient) {}

  create(input: CreateDocumentationRunInput): Promise<CreateDocumentationRunResponse> {
    return this.http.json('/v1/documentation-runs', {
      method: 'POST',
      body: JSON.stringify(input),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  async list(options: DocumentationRunListOptions = {}): Promise<DocumentationRunListResponse> {
    const limit = parseRunListLimit(options.limit);
    const status = parseRunListStatus(options.status);
    const role = parseRunListSourceRole(options.role);
    const name = parseRunListName(options.name);
    const format = parseRunListFormat(options.format);
    const sourceCountRange = parseRunListSourceCountRange(options.minSources, options.maxSources);
    const sort = parseRunListSort(options.sort);
    const cursor = parseRunListCursor(options.cursor);
    const createdAfter = parseRunListCreatedAfter(options.createdAfter);
    const createdBefore = parseRunListCreatedBefore(options.createdBefore);
    const updatedAfter = parseRunListUpdatedAfter(options.updatedAfter);
    const updatedBefore = parseRunListUpdatedBefore(options.updatedBefore);
    const query = new URLSearchParams();
    if (limit !== undefined) {
      query.set('limit', String(limit));
    }
    if (status !== undefined) {
      query.set('status', status);
    }
    if (role !== undefined) {
      query.set('role', role);
    }
    if (name !== undefined) {
      query.set('name', name);
    }
    if (format !== undefined) {
      query.set('format', format);
    }
    if (sourceCountRange.minSources !== undefined) {
      query.set('minSources', String(sourceCountRange.minSources));
    }
    if (sourceCountRange.maxSources !== undefined) {
      query.set('maxSources', String(sourceCountRange.maxSources));
    }
    if (sort !== undefined) {
      query.set('sort', sort);
    }
    if (createdAfter !== undefined) {
      query.set('createdAfter', createdAfter);
    }
    if (createdBefore !== undefined) {
      query.set('createdBefore', createdBefore);
    }
    if (updatedAfter !== undefined) {
      query.set('updatedAfter', updatedAfter);
    }
    if (updatedBefore !== undefined) {
      query.set('updatedBefore', updatedBefore);
    }
    if (cursor !== undefined) {
      query.set('cursor', cursor);
    }
    const queryString = query.toString();
    const path = queryString ? `/v1/documentation-runs?${queryString}` : '/v1/documentation-runs';
    return sanitizeRunListResponse(await this.http.json(path));
  }

  async uploadSources(
    runId: string,
    sources: UploadDocumentationSourceInput[]
  ): Promise<UploadDocumentationSourcesResponse> {
    assertSupportedArchiveSources(sources);

    const formData = new FormData();
    formData.append(
      'metadata',
      JSON.stringify({
        sources: sources.map((source, index) => ({
          fileField: `source_${index}`,
          name: source.name,
          role: source.role
        }))
      })
    );

    sources.forEach((source, index) => {
      formData.append(`source_${index}`, source.file, source.fileName);
    });

    return this.http.json(`/v1/documentation-runs/${runId}/sources`, {
      method: 'POST',
      body: formData
    });
  }

  start(runId: string): Promise<CreateDocumentationRunResponse> {
    return this.http.json(`/v1/documentation-runs/${runId}/start`, {
      method: 'POST'
    });
  }

  get(runId: string): Promise<DocumentationRun> {
    return this.http.json(`/v1/documentation-runs/${runId}`);
  }

  async waitUntilComplete(
    runId: string,
    options: PollDocumentationRunOptions = {}
  ): Promise<DocumentationRun> {
    const intervalMs = options.intervalMs ?? 1000;
    const timeoutMs = options.timeoutMs ?? 120000;
    const startedAt = Date.now();

    while (Date.now() - startedAt <= timeoutMs) {
      const run = await this.get(runId);
      if (run.status === 'completed') {
        return run;
      }

      if (run.status === 'failed' || run.status === 'cancelled' || run.status === 'expired') {
        throw new CodebaseDocsAIClientError(
          sanitizeSdkErrorString(
            run.error?.message ?? `Documentation run ended with status ${run.status}.`,
            `Documentation run ended with status ${run.status}.`
          ),
          0
        );
      }

      await delay(intervalMs);
    }

    throw new CodebaseDocsAIClientError(`Timed out waiting for documentation run ${runId}.`, 0);
  }

  getResult(runId: string): Promise<DocumentationRunResult> {
    return this.http.json(`/v1/documentation-runs/${runId}/result`);
  }

  async download(input: DownloadDocumentationInput): Promise<DownloadDocumentationResult> {
    const response = await this.http.raw(
      `/v1/documentation-runs/${input.runId}/download?format=${input.format}`
    );

    return {
      fileName: parseContentDispositionFileName(response.headers.get('content-disposition')),
      contentType: response.headers.get('content-type'),
      content: await response.blob()
    };
  }

  async generateFromArchives(
    input: GenerateFromArchivesInput
  ): Promise<GenerateFromArchivesResult> {
    assertSupportedArchiveSources(input.sources);

    const created = await this.create({
      name: input.name,
      options: input.options
    });
    await this.uploadSources(created.runId, input.sources);
    await this.start(created.runId);
    const run = await this.waitUntilComplete(created.runId, input.poll);
    const result = await this.getResult(created.runId);
    const download = input.downloadFormat
      ? await this.download({
          runId: created.runId,
          format: input.downloadFormat
        })
      : undefined;

    return {
      run,
      result,
      ...(download ? { download } : {})
    };
  }

  delete(runId: string): Promise<{ runId: string; deleted: boolean }> {
    return this.http.json(`/v1/documentation-runs/${runId}`, {
      method: 'DELETE'
    });
  }
}

class HttpClient {
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(config: CodebaseDocsAIClientConfig) {
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, '');
    this.fetchImpl = config.fetch ?? fetch;
  }

  async json<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await this.raw(path, init);
    return response.json() as Promise<T>;
  }

  async raw(path: string, init?: RequestInit): Promise<Response> {
    const response = await this.fetchImpl(`${this.apiBaseUrl}${path}`, init);

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      throw new CodebaseDocsAIClientError(
        error.message || `Request failed with status ${response.status}`,
        response.status,
        error.code,
        error.details
      );
    }

    return response;
  }
}

export class CodebaseDocsAIClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'CodebaseDocsAIClientError';
  }
}

function parseContentDispositionFileName(contentDisposition: string | null): string | null {
  if (!contentDisposition) {
    return null;
  }

  const match = contentDisposition.match(/filename="([^"]+)"/);
  return match?.[1] ?? null;
}

function assertSupportedArchiveSources(sources: UploadDocumentationSourceInput[]): void {
  const unsupportedSource = sources.find(
    (source) => !isSupportedSourceArchiveFileName(source.fileName)
  );
  if (!unsupportedSource) {
    return;
  }

  throw new CodebaseDocsAIClientError(
    `Unsupported source archive type: ${unsupportedSource.fileName}.`,
    0,
    'SOURCE_ARCHIVE_UNSUPPORTED_TYPE',
    {
      suggestion: `Upload one of the supported archive types: ${supportedSourceArchiveExtensions.join(', ')}.`,
      supportedExtensions: [...supportedSourceArchiveExtensions]
    }
  );
}

function sanitizeRunListResponse(response: DocumentationRunListResponse): DocumentationRunListResponse {
  return {
    runs: response.runs.map((run) => sanitizeRunSummary(run)),
    ...(response.nextCursor
      ? { nextCursor: sanitizeSdkErrorString(response.nextCursor, '[REDACTED]') }
      : {})
  };
}

function sanitizeRunSummary(run: DocumentationRunSummary): DocumentationRunSummary {
  return {
    ...run,
    id: sanitizeSdkErrorString(run.id, '[REDACTED]'),
    name: sanitizeSdkErrorString(run.name, '[REDACTED]'),
    sources: run.sources.map((source) => ({
      ...(source.id ? { id: sanitizeSdkErrorString(source.id, '[REDACTED]') } : {}),
      name: sanitizeSdkErrorString(source.name, '[REDACTED]'),
      role: source.role
    })),
    ...(run.progress
      ? {
          progress: {
            ...run.progress,
            currentStep: sanitizeSdkErrorString(run.progress.currentStep, '[REDACTED]')
          }
        }
      : {}),
    ...(run.error
      ? {
          error: {
            ...run.error,
            ...(run.error.code ? { code: sanitizeSdkErrorString(run.error.code, '[REDACTED]') } : {}),
            message: sanitizeSdkErrorString(run.error.message, 'Documentation generation failed.')
          }
        }
      : {})
  };
}

async function parseErrorResponse(
  response: Response
): Promise<Pick<ApiErrorPayload, 'message'> & Partial<Pick<ApiErrorPayload, 'code' | 'details'>>> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      return {
        message: sanitizeSdkErrorString(text, 'Request failed.')
      };
    }

    const nestedError = isRecord(parsed.error) ? parsed.error : undefined;
    const source = nestedError ?? parsed;
    return {
      message:
        typeof source.message === 'string'
          ? sanitizeSdkErrorString(source.message, 'Request failed.')
          : sanitizeSdkErrorString(text, 'Request failed.'),
      ...(typeof source.code === 'string' ? { code: source.code } : {}),
      ...('details' in source ? { details: sanitizePublicErrorValue(source.details) } : {})
    };
  } catch {
    return {
      message: sanitizeSdkErrorString(text, 'Request failed.')
    };
  }
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeSdkErrorString(value: string, fallback: string): string {
  return sanitizePublicErrorText(value, { fallback });
}

const runListFilterStatuses: DocumentationRunStatus[] = [
  'created',
  'uploading_sources',
  'ready',
  'running',
  'extracting_sources',
  'analyzing_sources',
  'building_system_map',
  'generating_documentation',
  'rendering_output',
  'completed',
  'failed',
  'cancelled',
  'expired'
];
const maxRunListCursorLength = 512;
const maxRunListNameLength = 200;
const runListIsoTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function parseRunListLimit(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > maxDocumentationRunListLimit
  ) {
    throw invalidRunListLimit();
  }

  return value;
}

function invalidRunListLimit(): CodebaseDocsAIClientError {
  return new CodebaseDocsAIClientError(
    `Run list limit must be an integer between 1 and ${maxDocumentationRunListLimit}.`,
    0,
    'RUN_LIST_LIMIT_INVALID',
    {
      min: 1,
      max: maxDocumentationRunListLimit
    }
  );
}

function parseRunListStatus(value: unknown): DocumentationRunStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !runListFilterStatuses.includes(value as DocumentationRunStatus)) {
    throw invalidRunListStatus();
  }

  return value as DocumentationRunStatus;
}

function invalidRunListStatus(): CodebaseDocsAIClientError {
  return new CodebaseDocsAIClientError(
    'Run list status must be a supported documentation run status.',
    0,
    'RUN_LIST_STATUS_INVALID',
    {
      allowedStatuses: [...runListFilterStatuses]
    }
  );
}

function parseRunListSourceRole(value: unknown): SourceRole | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !sourceRoles.includes(value as SourceRole)) {
    throw invalidRunListSourceRole();
  }

  return value as SourceRole;
}

function invalidRunListSourceRole(): CodebaseDocsAIClientError {
  return new CodebaseDocsAIClientError(
    'Run list source role must be a supported source role.',
    0,
    'RUN_LIST_SOURCE_ROLE_INVALID',
    {
      allowedRoles: [...sourceRoles]
    }
  );
}

function parseRunListName(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw invalidRunListName();
  }

  const name = value.trim();
  if (name.length === 0 || name.length > maxRunListNameLength) {
    throw invalidRunListName();
  }

  return name;
}

function invalidRunListName(): CodebaseDocsAIClientError {
  return new CodebaseDocsAIClientError(
    `Run list name filter must be between 1 and ${maxRunListNameLength} characters.`,
    0,
    'RUN_LIST_NAME_INVALID'
  );
}

function parseRunListFormat(value: unknown): DocumentationOutputFormat | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = documentationOutputFormatSchema.safeParse(value);
  if (!parsed.success) {
    throw invalidRunListFormat();
  }

  return parsed.data;
}

function invalidRunListFormat(): CodebaseDocsAIClientError {
  return new CodebaseDocsAIClientError(
    'Run list format must be a supported documentation output format.',
    0,
    'RUN_LIST_FORMAT_INVALID',
    {
      allowedFormats: [...documentationOutputFormatSchema.options]
    }
  );
}

function parseRunListSourceCountRange(
  minSourcesValue: unknown,
  maxSourcesValue: unknown
): { minSources?: number; maxSources?: number } {
  const minSources = parseRunListSourceCount(minSourcesValue);
  const maxSources = parseRunListSourceCount(maxSourcesValue);

  if (minSources !== undefined && maxSources !== undefined && minSources > maxSources) {
    throw invalidRunListSourceCount();
  }

  return {
    ...(minSources === undefined ? {} : { minSources }),
    ...(maxSources === undefined ? {} : { maxSources })
  };
}

function parseRunListSourceCount(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw invalidRunListSourceCount();
  }

  return value;
}

function invalidRunListSourceCount(): CodebaseDocsAIClientError {
  return new CodebaseDocsAIClientError(
    'Run list source count filters must be non-negative integers, and minSources must not exceed maxSources.',
    0,
    'RUN_LIST_SOURCE_COUNT_INVALID',
    {
      min: 0
    }
  );
}

const runListSortOptions = ['updatedAt:desc', 'updatedAt:asc'] as const;

function parseRunListSort(value: unknown): (typeof runListSortOptions)[number] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !runListSortOptions.includes(value as (typeof runListSortOptions)[number])) {
    throw invalidRunListSort();
  }

  return value as (typeof runListSortOptions)[number];
}

function invalidRunListSort(): CodebaseDocsAIClientError {
  return new CodebaseDocsAIClientError(
    'Run list sort must be a supported sort option.',
    0,
    'RUN_LIST_SORT_INVALID',
    {
      allowedSorts: [...runListSortOptions]
    }
  );
}

function parseRunListCursor(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.length === 0 || value.length > maxRunListCursorLength) {
    throw invalidRunListCursor();
  }

  return value;
}

function invalidRunListCursor(): CodebaseDocsAIClientError {
  return new CodebaseDocsAIClientError('Run list cursor is invalid.', 0, 'RUN_LIST_CURSOR_INVALID');
}

function parseRunListCreatedAfter(value: unknown): string | undefined {
  return parseRunListTimestamp(
    value,
    'RUN_LIST_CREATED_AFTER_INVALID',
    'Run list createdAfter must be a valid ISO timestamp.'
  );
}

function parseRunListCreatedBefore(value: unknown): string | undefined {
  return parseRunListTimestamp(
    value,
    'RUN_LIST_CREATED_BEFORE_INVALID',
    'Run list createdBefore must be a valid ISO timestamp.'
  );
}

function parseRunListUpdatedAfter(value: unknown): string | undefined {
  return parseRunListTimestamp(
    value,
    'RUN_LIST_UPDATED_AFTER_INVALID',
    'Run list updatedAfter must be a valid ISO timestamp.'
  );
}

function parseRunListUpdatedBefore(value: unknown): string | undefined {
  return parseRunListTimestamp(
    value,
    'RUN_LIST_UPDATED_BEFORE_INVALID',
    'Run list updatedBefore must be a valid ISO timestamp.'
  );
}

function parseRunListTimestamp(
  value: unknown,
  code: string,
  message: string
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== 'string' ||
    !runListIsoTimestampPattern.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw invalidRunListTimestamp(code, message);
  }

  return value;
}

function invalidRunListTimestamp(code: string, message: string): CodebaseDocsAIClientError {
  return new CodebaseDocsAIClientError(message, 0, code);
}
