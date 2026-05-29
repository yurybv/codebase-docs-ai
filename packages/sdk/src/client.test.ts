import { describe, expect, it, vi } from 'vitest';
import { CodebaseDocsAIClient, CodebaseDocsAIClientError } from './client.js';

describe('CodebaseDocsAIClient', () => {
  it('creates documentation runs through the HTTP API', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runId: 'run_123',
          status: 'created'
        }),
        {
          status: 200
        }
      )
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000/',
      fetch: fetchMock
    });

    await expect(
      client.documentationRuns.create({
        name: 'Docs',
        options: {
          outputFormats: ['markdown-tree'],
          language: 'en',
          includeSourceReferences: true,
          includeWarnings: true
        }
      })
    ).resolves.toEqual({
      runId: 'run_123',
      status: 'created'
    });

    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/v1/documentation-runs', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Docs',
        options: {
          outputFormats: ['markdown-tree'],
          language: 'en',
          includeSourceReferences: true,
          includeWarnings: true
        }
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  });

  it('uploads sources as multipart form data', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runId: 'run_123',
          status: 'ready',
          sources: []
        }),
        {
          status: 200
        }
      )
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    await client.documentationRuns.uploadSources('run_123', [
      {
        name: 'Frontend',
        role: 'frontend',
        fileName: 'frontend.zip',
        file: new Blob(['zip'])
      }
    ]);

    const [, init] = fetchMock.mock.calls[0] ?? [];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBeInstanceOf(FormData);
    const formData = init?.body as FormData;
    expect(JSON.parse(String(formData.get('metadata')))).toEqual({
      sources: [
        {
          fileField: 'source_0',
          name: 'Frontend',
          role: 'frontend'
        }
      ]
    });
    expect(formData.get('source_0')).toBeInstanceOf(File);
  });

  it('deletes documentation runs through the HTTP API', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        runId: 'run_123',
        deleted: true
      })
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    await expect(client.documentationRuns.delete('run_123')).resolves.toEqual({
      runId: 'run_123',
      deleted: true
    });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3000/v1/documentation-runs/run_123', {
      method: 'DELETE'
    });
  });

  it('polls and runs the high-level archive generation flow', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ runId: 'run_123', status: 'created' }))
      .mockResolvedValueOnce(jsonResponse({ runId: 'run_123', status: 'ready', sources: [] }))
      .mockResolvedValueOnce(jsonResponse({ runId: 'run_123', status: 'running' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'run_123', status: 'running' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'run_123', status: 'completed' }))
      .mockResolvedValueOnce(
        jsonResponse({
          runId: 'run_123',
          status: 'completed',
          renderedFormats: ['single-markdown'],
          documentation: {
            title: 'Docs',
            summary: 'Generated',
            pages: [],
            warnings: [],
            sourceReferences: [],
            generatedAt: '2026-05-29T00:00:00.000Z'
          }
        })
      )
      .mockResolvedValueOnce(
        new Response('markdown', {
          status: 200,
          headers: {
            'content-disposition': 'attachment; filename="PROJECT_DOCUMENTATION.md"',
            'content-type': 'text/markdown'
          }
        })
      );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    const result = await client.documentationRuns.generateFromArchives({
      name: 'Docs',
      options: {
        outputFormats: ['single-markdown'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      },
      sources: [
        {
          name: 'Frontend',
          role: 'frontend',
          fileName: 'frontend.zip',
          file: new Blob(['zip'])
        }
      ],
      poll: {
        intervalMs: 0,
        timeoutMs: 1000
      },
      downloadFormat: 'single-markdown'
    });

    expect(result.run.status).toBe('completed');
    expect(result.result.renderedFormats).toEqual(['single-markdown']);
    expect(result.result.documentation.title).toBe('Docs');
    expect(result.download?.fileName).toBe('PROJECT_DOCUMENTATION.md');
  });

  it('surfaces failed run messages while polling', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: 'run_123',
        status: 'failed',
        error: {
          message: 'Generation failed.'
        }
      })
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    await expect(
      client.documentationRuns.waitUntilComplete('run_123', {
        intervalMs: 0,
        timeoutMs: 10
      })
    ).rejects.toThrow('Generation failed.');
  });

  it('times out while polling non-terminal runs', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockImplementation(async () =>
      jsonResponse({
        id: 'run_123',
        status: 'running'
      })
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    await expect(
      client.documentationRuns.waitUntilComplete('run_123', {
        intervalMs: 0,
        timeoutMs: 0
      })
    ).rejects.toMatchObject({
      name: 'CodebaseDocsAIClientError',
      status: 0,
      message: 'Timed out waiting for documentation run run_123.'
    });
  });

  it('preserves API error codes and details', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'INVALID_SOURCE_METADATA',
            message: 'Source upload metadata is invalid.',
            details: {
              fieldErrors: {
                sources: ['Required']
              }
            }
          }
        }),
        {
          status: 400,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    try {
      await client.documentationRuns.get('run_123');
      throw new Error('Expected request to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CodebaseDocsAIClientError);
      expect((error as CodebaseDocsAIClientError).status).toBe(400);
      expect((error as CodebaseDocsAIClientError).code).toBe('INVALID_SOURCE_METADATA');
      expect((error as CodebaseDocsAIClientError).details).toEqual({
        fieldErrors: {
          sources: ['Required']
        }
      });
    }
  });

  it('preserves legacy flat API error shapes defensively', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'LEGACY_ERROR',
          message: 'Legacy flat error.',
          details: {
            reason: 'fixture'
          }
        }),
        {
          status: 422,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    await expect(client.documentationRuns.get('run_123')).rejects.toMatchObject({
      status: 422,
      code: 'LEGACY_ERROR',
      details: {
        reason: 'fixture'
      }
    });
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json'
    }
  });
}
