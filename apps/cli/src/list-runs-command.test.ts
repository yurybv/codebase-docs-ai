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
});
