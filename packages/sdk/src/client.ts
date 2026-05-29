import type {
  CodebaseDocsAIClientConfig,
  CreateDocumentationRunInput,
  CreateDocumentationRunResponse,
  DocumentationRunResult,
  DocumentationRunsClient,
  DownloadDocumentationInput,
  DownloadDocumentationResult,
  UploadDocumentationSourceInput,
  UploadDocumentationSourcesResponse
} from './sdk-types.js';
import type { DocumentationRun } from '@codebase-docs-ai/shared';

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
      const message = await response.text();
      throw new CodebaseDocsAIClientError(
        message || `Request failed with status ${response.status}`,
        response.status
      );
    }

    return response;
  }
}

export class CodebaseDocsAIClientError extends Error {
  constructor(
    message: string,
    readonly status: number
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
