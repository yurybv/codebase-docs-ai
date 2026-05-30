import { describe, expect, it, vi } from 'vitest';
import AdmZip from 'adm-zip';
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

  it('lists sanitized documentation run summaries through the HTTP API', async () => {
    const rawOpenAiKey = `sk-${'l'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        runs: [
          {
            id: 'run_created',
            name: `Created ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
            status: 'created',
            sources: [],
            sourceCount: 0,
            outputFormats: ['json'],
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:00:00.000Z'
          },
          {
            id: 'run_completed',
            name: 'Completed Docs',
            status: 'completed',
            sources: [
              {
                id: `source_${rawOpenAiKey}`,
                name: `Frontend ${rawStoragePath}`,
                role: 'frontend'
              }
            ],
            sourceCount: 1,
            outputFormats: ['single-markdown'],
            renderedFormats: ['single-markdown'],
            progress: {
              currentStep: `Documentation run completed from ${rawStoragePath}`,
              completedSteps: 7,
              totalSteps: 7
            },
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:01:00.000Z'
          },
          {
            id: 'run_failed',
            name: 'Failed Docs',
            status: 'failed',
            sources: [
              {
                name: `Backend .env SHOULD_NOT_APPEAR ${rawOpenAiKey}`,
                role: 'backend'
              }
            ],
            sourceCount: 1,
            outputFormats: ['json'],
            error: {
              message: `Documentation generation failed at ${rawStoragePath}.`,
              code: `FAILED_${rawOpenAiKey}`
            },
            createdAt: '2026-05-30T00:00:00.000Z',
            updatedAt: '2026-05-30T00:02:00.000Z'
          }
        ]
      })
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    const list = await client.documentationRuns.list();
    const payload = JSON.stringify(list);

    expect(list.runs.map((run) => run.id)).toEqual([
      'run_created',
      'run_completed',
      'run_failed'
    ]);
    expect(list.runs[0]).toMatchObject({
      status: 'created',
      sourceCount: 0,
      outputFormats: ['json']
    });
    expect(list.runs[1]).toMatchObject({
      status: 'completed',
      sourceCount: 1,
      renderedFormats: ['single-markdown']
    });
    expect(list.runs[2]).toMatchObject({
      status: 'failed',
      sourceCount: 1
    });
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_STORAGE_PATH]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawStoragePath);
    expect(payload).not.toContain('/private/tmp');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs',
      undefined
    );
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

  it('rejects unsupported archive uploads before network requests', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    await expect(
      client.documentationRuns.uploadSources('run_123', [
        {
          name: 'Notes',
          role: 'docs',
          fileName: 'notes.txt',
          file: new Blob(['text'])
        }
      ])
    ).rejects.toMatchObject({
      name: 'CodebaseDocsAIClientError',
      status: 0,
      code: 'SOURCE_ARCHIVE_UNSUPPORTED_TYPE',
      message: 'Unsupported source archive type: notes.txt.',
      details: {
        suggestion: 'Upload one of the supported archive types: .zip, .tar, .tar.gz, .tgz.',
        supportedExtensions: ['.zip', '.tar', '.tar.gz', '.tgz']
      }
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported high-level archive generation inputs before creating runs', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    await expect(
      client.documentationRuns.generateFromArchives({
        name: 'Docs',
        options: {
          outputFormats: ['single-markdown'],
          language: 'en',
          includeSourceReferences: true,
          includeWarnings: true
        },
        sources: [
          {
            name: 'Notes',
            role: 'docs',
            fileName: 'notes.txt',
            file: new Blob(['text'])
          }
        ]
      })
    ).rejects.toMatchObject({
      status: 0,
      code: 'SOURCE_ARCHIVE_UNSUPPORTED_TYPE'
    });
    expect(fetchMock).not.toHaveBeenCalled();
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

  it('preserves multi-source metadata and rendered formats in the high-level archive flow', async () => {
    const outputFormats = ['markdown-tree', 'single-markdown', 'json'] as const;
    const documentation = {
      title: 'SDK Multi Source Documentation',
      summary: 'Generated',
      pages: [
        {
          key: 'overview',
          title: '01. Overview',
          order: 1,
          markdown:
            '| Source | Role |\n| --- | --- |\n| Frontend | frontend |\n| Backend | backend |',
          sourceReferences: [],
          warnings: []
        },
        {
          key: 'api-contracts',
          title: '06. API Contracts',
          order: 6,
          markdown:
            '| GET | /api/users | matched | Frontend:src/api.ts | Backend:src/users.controller.ts |',
          sourceReferences: [],
          warnings: []
        }
      ],
      warnings: [],
      sourceReferences: [],
      generatedAt: '2026-05-29T00:00:00.000Z'
    };
    let createdRunBody:
      | {
          options?: {
            outputFormats?: string[];
          };
        }
      | undefined;
    let uploadedMetadata:
      | {
          sources: Array<{
            fileField: string;
            name: string;
            role: string;
          }>;
        }
      | undefined;
    let downloadUrl = '';
    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/v1/documentation-runs') && init?.method === 'POST') {
        createdRunBody = JSON.parse(String(init.body)) as typeof createdRunBody;
        return jsonResponse({ runId: 'run_multi_source', status: 'created' });
      }

      if (url.endsWith('/v1/documentation-runs/run_multi_source/sources')) {
        uploadedMetadata = JSON.parse(
          String((init?.body as FormData).get('metadata'))
        ) as typeof uploadedMetadata;
        return jsonResponse({ runId: 'run_multi_source', status: 'ready', sources: [] });
      }

      if (url.endsWith('/v1/documentation-runs/run_multi_source/start')) {
        return jsonResponse({ runId: 'run_multi_source', status: 'running' });
      }

      if (url.endsWith('/v1/documentation-runs/run_multi_source')) {
        return jsonResponse({
          id: 'run_multi_source',
          status: 'completed',
          renderedFormats: [...outputFormats]
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_multi_source/result')) {
        return jsonResponse({
          runId: 'run_multi_source',
          status: 'completed',
          renderedFormats: [...outputFormats],
          documentation
        });
      }

      if (url.endsWith('/v1/documentation-runs/run_multi_source/download?format=json')) {
        downloadUrl = url;
        return new Response(JSON.stringify(documentation, null, 2), {
          status: 200,
          headers: {
            'content-disposition': 'attachment; filename="documentation-tree.json"',
            'content-type': 'application/json'
          }
        });
      }

      throw new Error(`Unexpected request: ${url}`);
    });
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    const result = await client.documentationRuns.generateFromArchives({
      name: 'SDK Multi Source Documentation',
      options: {
        outputFormats: [...outputFormats],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      },
      sources: [
        {
          name: 'Frontend',
          role: 'frontend',
          fileName: 'frontend.zip',
          file: new Blob(['frontend'])
        },
        {
          name: 'Backend',
          role: 'backend',
          fileName: 'backend.zip',
          file: new Blob(['backend'])
        }
      ],
      poll: {
        intervalMs: 0,
        timeoutMs: 1000
      },
      downloadFormat: 'json'
    });

    const downloadedJson = await result.download?.content.text();
    expect(createdRunBody?.options?.outputFormats).toEqual([...outputFormats]);
    expect(uploadedMetadata?.sources).toEqual([
      {
        fileField: 'source_0',
        name: 'Frontend',
        role: 'frontend'
      },
      {
        fileField: 'source_1',
        name: 'Backend',
        role: 'backend'
      }
    ]);
    expect(result.run.renderedFormats).toEqual([...outputFormats]);
    expect(result.result.renderedFormats).toEqual([...outputFormats]);
    expect(result.download?.fileName).toBe('documentation-tree.json');
    expect(downloadUrl).toBe(
      'http://localhost:3000/v1/documentation-runs/run_multi_source/download?format=json'
    );
    expectConsistentMultiSourceArtifact(JSON.stringify(result.result.documentation));
    expectConsistentMultiSourceArtifact(downloadedJson ?? '');
  });

  it('preserves sanitized downloaded artifacts in the high-level archive flow', async () => {
    const rawOpenAiKey = `sk-${'g'.repeat(24)}`;
    const embeddedOpenAiKey = `prefix_${rawOpenAiKey}`;
    const sanitizedMarkdown = [
      '# 01. Overview',
      '',
      '| POST | /v1/prefix_[REDACTED_OPENAI_API_KEY]/[REDACTED_DENIED_FILE]/[REDACTED_DENIED_VALUE] | unmatched |'
    ].join('\n');
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ runId: 'run_123', status: 'created' }))
      .mockResolvedValueOnce(jsonResponse({ runId: 'run_123', status: 'ready', sources: [] }))
      .mockResolvedValueOnce(jsonResponse({ runId: 'run_123', status: 'running' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'run_123', status: 'completed' }))
      .mockResolvedValueOnce(
        jsonResponse({
          runId: 'run_123',
          status: 'completed',
          renderedFormats: ['single-markdown'],
          documentation: {
            title: 'Sanitized SDK Docs',
            summary: 'Generated',
            pages: [
              {
                key: 'api-contracts',
                title: '06. API Contracts',
                order: 6,
                markdown: sanitizedMarkdown,
                sourceReferences: [],
                warnings: []
              }
            ],
            warnings: [],
            sourceReferences: [],
            generatedAt: '2026-05-29T00:00:00.000Z'
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(sanitizedMarkdown, {
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
      name: 'Sanitized SDK Docs',
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
          file: new Blob([
            `fetch("https://api.example.com/v1/${embeddedOpenAiKey}/.env/SHOULD_NOT_APPEAR");\n`,
            'IGNORED_ENV=process.env.SHOULD_NOT_APPEAR\n'
          ])
        }
      ],
      poll: {
        intervalMs: 0,
        timeoutMs: 1000
      },
      downloadFormat: 'single-markdown'
    });

    const documentationPayload = JSON.stringify(result.result.documentation);
    const downloadedMarkdown = await result.download?.content.text();
    expect(documentationPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(documentationPayload).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(documentationPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(documentationPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(documentationPayload).not.toContain(rawOpenAiKey);
    expect(documentationPayload).not.toContain(embeddedOpenAiKey);
    expect(documentationPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(downloadedMarkdown).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(downloadedMarkdown).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(downloadedMarkdown).toContain('[REDACTED_DENIED_FILE]');
    expect(downloadedMarkdown).toContain('[REDACTED_DENIED_VALUE]');
    expect(downloadedMarkdown).not.toContain(rawOpenAiKey);
    expect(downloadedMarkdown).not.toContain(embeddedOpenAiKey);
    expect(downloadedMarkdown).not.toContain('SHOULD_NOT_APPEAR');
    expect(downloadedMarkdown).not.toContain('.env');
  });

  it('preserves sanitized documentation trees from direct result retrieval', async () => {
    const rawOpenAiKey = `sk-${'h'.repeat(24)}`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        runId: 'run_123',
        status: 'completed',
        renderedFormats: ['json'],
        documentation: {
          title: 'Sanitized Result Tree',
          summary: 'Generated',
          pages: [
            {
              key: 'api-contracts',
              title: '06. API Contracts',
              order: 6,
              markdown:
                '| POST | /v1/prefix_[REDACTED_OPENAI_API_KEY]/[REDACTED_DENIED_FILE]/[REDACTED_DENIED_VALUE] | unmatched |',
              sourceReferences: [],
              warnings: []
            }
          ],
          warnings: [],
          sourceReferences: [],
          generatedAt: '2026-05-29T00:00:00.000Z'
        }
      })
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    const result = await client.documentationRuns.getResult('run_123');
    const payload = JSON.stringify(result.documentation);

    expect(result.renderedFormats).toEqual(['json']);
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain('.env');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs/run_123/result',
      undefined
    );
  });

  it('preserves sanitized JSON downloads', async () => {
    const rawOpenAiKey = `sk-${'o'.repeat(24)}`;
    const sanitizedJson = JSON.stringify(
      {
        title: 'Sanitized SDK JSON Download',
        summary: 'Generated',
        pages: [
          {
            key: 'api-contracts',
            title: '06. API Contracts',
            order: 6,
            markdown:
              '| POST | /v1/prefix_[REDACTED_OPENAI_API_KEY]/[REDACTED_DENIED_FILE]/[REDACTED_DENIED_VALUE] | unmatched |',
            sourceReferences: [],
            warnings: []
          }
        ],
        warnings: [],
        sourceReferences: [],
        generatedAt: '2026-05-29T00:00:00.000Z'
      },
      null,
      2
    );
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(sanitizedJson, {
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="documentation-tree.json"',
          'content-type': 'application/json'
        }
      })
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    const download = await client.documentationRuns.download({
      runId: 'run_123',
      format: 'json'
    });
    const json = await download.content.text();

    expect(download.fileName).toBe('documentation-tree.json');
    expect(download.contentType).toContain('application/json');
    expect(JSON.parse(json)).toMatchObject({
      title: 'Sanitized SDK JSON Download'
    });
    expect(json).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(json).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(json).toContain('[REDACTED_DENIED_FILE]');
    expect(json).toContain('[REDACTED_DENIED_VALUE]');
    expect(json).not.toContain(rawOpenAiKey);
    expect(json).not.toContain('SHOULD_NOT_APPEAR');
    expect(json).not.toContain('.env');
  });

  it('preserves sanitized single-Markdown downloads', async () => {
    const rawOpenAiKey = `sk-${'p'.repeat(24)}`;
    const sanitizedMarkdown = [
      '# 06. API Contracts',
      '',
      '| POST | /v1/prefix_[REDACTED_OPENAI_API_KEY]/[REDACTED_DENIED_FILE]/[REDACTED_DENIED_VALUE] | unmatched |'
    ].join('\n');
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(sanitizedMarkdown, {
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

    const download = await client.documentationRuns.download({
      runId: 'run_123',
      format: 'single-markdown'
    });
    const markdown = await download.content.text();

    expect(download.fileName).toBe('PROJECT_DOCUMENTATION.md');
    expect(download.contentType).toContain('text/markdown');
    expect(markdown).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(markdown).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(markdown).toContain('[REDACTED_DENIED_FILE]');
    expect(markdown).toContain('[REDACTED_DENIED_VALUE]');
    expect(markdown).not.toContain(rawOpenAiKey);
    expect(markdown).not.toContain('SHOULD_NOT_APPEAR');
    expect(markdown).not.toContain('.env');
  });

  it('preserves sanitized markdown-tree zip downloads', async () => {
    const rawOpenAiKey = `sk-${'j'.repeat(24)}`;
    const sanitizedZip = new AdmZip();
    sanitizedZip.addFile(
      '06-api-contracts.md',
      Buffer.from(
        '| POST | /v1/prefix_[REDACTED_OPENAI_API_KEY]/[REDACTED_DENIED_FILE]/[REDACTED_DENIED_VALUE] | unmatched |\n'
      )
    );
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(sanitizedZip.toBuffer(), {
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="documentation.zip"',
          'content-type': 'application/zip'
        }
      })
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    const download = await client.documentationRuns.download({
      runId: 'run_123',
      format: 'markdown-tree'
    });
    const zip = new AdmZip(Buffer.from(await download.content.arrayBuffer()));
    const zipContent = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.getData().toString('utf8'))
      .join('\n');

    expect(download.fileName).toBe('documentation.zip');
    expect(download.contentType).toContain('application/zip');
    expect(zipContent).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(zipContent).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(zipContent).toContain('[REDACTED_DENIED_FILE]');
    expect(zipContent).toContain('[REDACTED_DENIED_VALUE]');
    expect(zipContent).not.toContain(rawOpenAiKey);
    expect(zipContent).not.toContain('SHOULD_NOT_APPEAR');
    expect(zipContent).not.toContain('.env');
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

  it('sanitizes expired run polling errors before throwing', async () => {
    const rawOpenAiKey = `sk-${'w'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/documentation-tree.json`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      jsonResponse({
        id: 'run_expired',
        status: 'expired',
        error: {
          message: `Documentation run expired while reading ${rawStoragePath}.`
        }
      })
    );
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: fetchMock
    });

    try {
      await client.documentationRuns.waitUntilComplete('run_expired', {
        intervalMs: 0,
        timeoutMs: 10
      });
      throw new Error('Expected expired run polling to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CodebaseDocsAIClientError);
      expect((error as CodebaseDocsAIClientError).status).toBe(0);
      expect((error as CodebaseDocsAIClientError).message).toContain('[REDACTED_STORAGE_PATH]');
      expectSafeSdkError(error, rawOpenAiKey, rawStoragePath);
    }
  });

  it('surfaces safe expired and missing-artifact API envelopes', async () => {
    const rawOpenAiKey = `sk-${'z'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/rendered-single-markdown.json`;
    const client = new CodebaseDocsAIClient({
      apiBaseUrl: 'http://localhost:3000',
      fetch: vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          jsonErrorResponse(
            400,
            'DOCUMENTATION_RESULT_ARTIFACT_MISSING',
            `Documentation result artifact is unavailable at ${rawStoragePath}.`,
            {
              path: rawStoragePath
            }
          )
        )
        .mockResolvedValueOnce(
          jsonErrorResponse(
            400,
            'DOCUMENTATION_DOWNLOAD_ARTIFACT_MISSING',
            `Documentation download artifact is unavailable at ${rawStoragePath}.`,
            {
              path: rawStoragePath
            }
          )
        )
        .mockResolvedValueOnce(
          jsonErrorResponse(
            404,
            'DOCUMENTATION_RUN_NOT_FOUND',
            `Documentation run was not found after cleanup at ${rawStoragePath}.`,
            {
              path: rawStoragePath
            }
          )
        )
    });

    await expectSdkError(
      client.documentationRuns.getResult('run_missing'),
      {
        status: 400,
        code: 'DOCUMENTATION_RESULT_ARTIFACT_MISSING'
      },
      rawOpenAiKey,
      rawStoragePath
    );
    await expectSdkError(
      client.documentationRuns.download({
        runId: 'run_missing',
        format: 'single-markdown'
      }),
      {
        status: 400,
        code: 'DOCUMENTATION_DOWNLOAD_ARTIFACT_MISSING'
      },
      rawOpenAiKey,
      rawStoragePath
    );
    await expectSdkError(
      client.documentationRuns.delete('run_missing'),
      {
        status: 404,
        code: 'DOCUMENTATION_RUN_NOT_FOUND'
      },
      rawOpenAiKey,
      rawStoragePath
    );
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

  it('sanitizes secret-bearing API errors before throwing', async () => {
    const rawOpenAiKey = `sk-${'v'.repeat(24)}`;
    const embeddedOpenAiKey = `prefix_${rawOpenAiKey}`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: {
            code: 'SOURCE_UPLOAD_INVALID',
            message: `Upload failed for ${embeddedOpenAiKey} from .env SHOULD_NOT_APPEAR.`,
            details: {
              fieldErrors: {
                sources: [`Remove ${embeddedOpenAiKey} from .env SHOULD_NOT_APPEAR.`]
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
      const payload = JSON.stringify(error);
      expect(error).toBeInstanceOf(CodebaseDocsAIClientError);
      expect((error as CodebaseDocsAIClientError).message).toContain('[REDACTED_OPENAI_API_KEY]');
      expect((error as CodebaseDocsAIClientError).details).toEqual({
        fieldErrors: {
          sources: [
            'Remove prefix_[REDACTED_OPENAI_API_KEY] from [REDACTED_DENIED_FILE] [REDACTED_DENIED_VALUE].'
          ]
        }
      });
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
      expect(payload).not.toContain('.env');
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

function jsonErrorResponse(
  status: number,
  code: string,
  message: string,
  details: unknown
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message,
        details
      }
    }),
    {
      status,
      headers: {
        'content-type': 'application/json'
      }
    }
  );
}

function expectConsistentMultiSourceArtifact(content: string): void {
  expect(content).toContain('Frontend');
  expect(content).toContain('frontend');
  expect(content).toContain('Backend');
  expect(content).toContain('backend');
  expect(content).toContain('/api/users');
  expect(content).toContain('matched');
  expect(content).not.toContain('No source input was marked as frontend');
  expect(content).not.toContain('No source input was marked as backend');
}

async function expectSdkError(
  action: Promise<unknown>,
  expected: {
    status: number;
    code: string;
  },
  rawOpenAiKey: string,
  rawStoragePath: string
): Promise<void> {
  try {
    await action;
    throw new Error('Expected SDK request to fail.');
  } catch (error) {
    expect(error).toBeInstanceOf(CodebaseDocsAIClientError);
    expect((error as CodebaseDocsAIClientError).status).toBe(expected.status);
    expect((error as CodebaseDocsAIClientError).code).toBe(expected.code);
    expect((error as CodebaseDocsAIClientError).message).toContain('[REDACTED_STORAGE_PATH]');
    expect((error as CodebaseDocsAIClientError).details).toEqual({
      path: '[REDACTED_STORAGE_PATH]'
    });
    expectSafeSdkError(error, rawOpenAiKey, rawStoragePath);
  }
}

function expectSafeSdkError(error: unknown, rawOpenAiKey: string, rawStoragePath: string): void {
  const payload = JSON.stringify(error);
  expect(payload).not.toContain(rawStoragePath);
  expect(payload).not.toContain(rawOpenAiKey);
  expect(payload).not.toContain('SHOULD_NOT_APPEAR');
  expect(payload).not.toContain('.env');
  expect(payload).not.toContain('/private/tmp');
}
