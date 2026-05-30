import { afterEach, describe, expect, it, vi } from 'vitest';
import { runListRunsCommand } from './list-runs-command.js';

describe('runListRunsCommand', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prints sanitized API run summaries without artifact or upload storage evidence', async () => {
    const rawOpenAiKey = `sk-${'u'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
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
                  name: `Frontend ${rawStoragePath}`,
                  role: 'frontend'
                }
              ],
              sourceCount: 1,
              outputFormats: ['single-markdown'],
              renderedFormats: ['single-markdown'],
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
                message: `Documentation generation failed at ${rawStoragePath}.`
              },
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-30T00:02:00.000Z'
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await runListRunsCommand({
      apiUrl: 'http://localhost:3000'
    });
    const payload = JSON.stringify(result);

    expect(result.status).toBe('completed');
    expect(result.runCount).toBe(3);
    expect(result.runs.map((run) => run.id)).toEqual([
      'run_created',
      'run_completed',
      'run_failed'
    ]);
    expect(result.runs[1]?.renderedFormats).toEqual(['single-markdown']);
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_STORAGE_PATH]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawStoragePath);
    expect(payload).not.toContain('/private/tmp');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain('archivePath');
    expect(payload).not.toContain('tempPath');
    expect(payload).not.toContain('documentationTreePath');
    expect(payload).not.toContain('renderedPaths');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/v1/documentation-runs',
      undefined
    );
  });

  it('passes list limits through the SDK while preserving sanitized output', async () => {
    const rawOpenAiKey = `sk-${'v'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runs: [
            {
              id: 'run_limited',
              name: `Limited ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
              status: 'completed',
              sources: [
                {
                  name: `Frontend ${rawStoragePath}`,
                  role: 'frontend'
                }
              ],
              sourceCount: 1,
              outputFormats: ['json'],
              renderedFormats: ['json'],
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-30T00:01:00.000Z'
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await runListRunsCommand({
      apiUrl: 'http://localhost:3000',
      limit: 2
    });
    const payload = JSON.stringify(result);

    expect(result.status).toBe('completed');
    expect(result.runCount).toBe(1);
    expect(result.runs[0]).toMatchObject({
      id: 'run_limited',
      status: 'completed',
      sourceCount: 1,
      renderedFormats: ['json']
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
      'http://localhost:3000/v1/documentation-runs?limit=2',
      undefined
    );
  });

  it('passes status filters through the SDK while preserving sanitized output', async () => {
    const rawOpenAiKey = `sk-${'s'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runs: [
            {
              id: 'run_failed',
              name: `Failed ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
              status: 'failed',
              sources: [
                {
                  name: `Backend ${rawStoragePath}`,
                  role: 'backend'
                }
              ],
              sourceCount: 1,
              outputFormats: ['json'],
              error: {
                message: `Documentation generation failed at ${rawStoragePath}.`
              },
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-30T00:01:00.000Z'
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await runListRunsCommand({
      apiUrl: 'http://localhost:3000',
      limit: 2,
      status: 'failed'
    });
    const payload = JSON.stringify(result);

    expect(result.status).toBe('completed');
    expect(result.runCount).toBe(1);
    expect(result.runs[0]).toMatchObject({
      id: 'run_failed',
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
      'http://localhost:3000/v1/documentation-runs?limit=2&status=failed',
      undefined
    );
  });

  it('passes source role filters through the SDK while preserving sanitized output', async () => {
    const rawOpenAiKey = `sk-${'r'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runs: [
            {
              id: 'run_backend',
              name: `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
              status: 'completed',
              sources: [
                {
                  name: `Backend ${rawStoragePath}`,
                  role: 'backend'
                }
              ],
              sourceCount: 1,
              outputFormats: ['json'],
              renderedFormats: ['json'],
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-30T00:01:00.000Z'
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await runListRunsCommand({
      apiUrl: 'http://localhost:3000',
      limit: 2,
      status: 'completed',
      role: 'backend'
    });
    const payload = JSON.stringify(result);

    expect(result.status).toBe('completed');
    expect(result.runCount).toBe(1);
    expect(result.runs[0]).toMatchObject({
      id: 'run_backend',
      status: 'completed',
      sourceCount: 1,
      renderedFormats: ['json']
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
      'http://localhost:3000/v1/documentation-runs?limit=2&status=completed&role=backend',
      undefined
    );
  });

  it('passes pagination cursors through the SDK while preserving sanitized output', async () => {
    const rawOpenAiKey = `sk-${'c'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const cursor = 'eyJ1cGRhdGVkQXQiOiIyMDI2LTA1LTMwVDAwOjAxOjAwLjAwMFoiLCJpZCI6InJ1bl8xMjMifQ';
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runs: [
            {
              id: 'run_next_page',
              name: `Next Page ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
              status: 'completed',
              sources: [
                {
                  name: `Backend ${rawStoragePath}`,
                  role: 'backend'
                }
              ],
              sourceCount: 1,
              outputFormats: ['json'],
              renderedFormats: ['json'],
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-30T00:01:00.000Z'
            }
          ],
          nextCursor: `${rawStoragePath}_${rawOpenAiKey}`
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await runListRunsCommand({
      apiUrl: 'http://localhost:3000',
      limit: 2,
      status: 'completed',
      role: 'backend',
      cursor
    });
    const payload = JSON.stringify(result);

    expect(result.status).toBe('completed');
    expect(result.runCount).toBe(1);
    expect(result.runs[0]).toMatchObject({
      id: 'run_next_page',
      status: 'completed',
      sourceCount: 1,
      renderedFormats: ['json']
    });
    expect(result.nextCursor).toContain('[REDACTED_STORAGE_PATH]');
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
      `http://localhost:3000/v1/documentation-runs?limit=2&status=completed&role=backend&cursor=${cursor}`,
      undefined
    );
  });

  it('passes updated-at filters through the SDK while preserving sanitized output', async () => {
    const rawOpenAiKey = `sk-${'d'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          runs: [
            {
              id: 'run_updated_range',
              name: `Updated Range ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
              status: 'completed',
              sources: [
                {
                  name: `Backend ${rawStoragePath}`,
                  role: 'backend'
                }
              ],
              sourceCount: 1,
              outputFormats: ['json'],
              renderedFormats: ['json'],
              createdAt: '2026-05-30T00:00:00.000Z',
              updatedAt: '2026-05-30T00:01:00.000Z'
            }
          ]
        }),
        {
          status: 200,
          headers: {
            'content-type': 'application/json'
          }
        }
      )
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await runListRunsCommand({
      apiUrl: 'http://localhost:3000',
      limit: 2,
      status: 'completed',
      role: 'backend',
      updatedAfter: '2026-05-30T00:00:30.000Z',
      updatedBefore: '2026-05-30T00:01:30.000Z'
    });
    const payload = JSON.stringify(result);

    expect(result.status).toBe('completed');
    expect(result.runCount).toBe(1);
    expect(result.runs[0]).toMatchObject({
      id: 'run_updated_range',
      status: 'completed',
      sourceCount: 1,
      renderedFormats: ['json']
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
      'http://localhost:3000/v1/documentation-runs?limit=2&status=completed&role=backend&updatedAfter=2026-05-30T00%3A00%3A30.000Z&updatedBefore=2026-05-30T00%3A01%3A30.000Z',
      undefined
    );
  });
});
