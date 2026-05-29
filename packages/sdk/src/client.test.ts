import { describe, expect, it, vi } from 'vitest';
import { CodebaseDocsAIClient } from './client.js';

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
  });
});
