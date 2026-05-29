import type {
  CodebaseDocsAIClientConfig,
  CreateDocumentationRunInput,
  CreateDocumentationRunResponse,
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
import type { ApiErrorPayload, DocumentationRun } from '@codebase-docs-ai/shared';

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

  uploadSources(
    runId: string,
    sources: UploadDocumentationSourceInput[]
  ): Promise<UploadDocumentationSourcesResponse> {
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
          run.error?.message ?? `Documentation run ended with status ${run.status}.`,
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

  async generateFromArchives(input: GenerateFromArchivesInput): Promise<GenerateFromArchivesResult> {
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

async function parseErrorResponse(
  response: Response
): Promise<Pick<ApiErrorPayload, 'message'> & Partial<Pick<ApiErrorPayload, 'code' | 'details'>>> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) {
      return {
        message: text
      };
    }

    const nestedError = isRecord(parsed.error) ? parsed.error : undefined;
    const source = nestedError ?? parsed;
    return {
      message: typeof source.message === 'string' ? source.message : text,
      ...(typeof source.code === 'string' ? { code: source.code } : {}),
      ...('details' in source ? { details: source.details } : {})
    };
  } catch {
    return {
      message: text
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
