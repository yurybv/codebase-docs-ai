import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentationRunsService } from './documentation-runs.service.js';

let tempRoot: string;
let service: DocumentationRunsService;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-api-'));
  process.env.DOCS_AI_TMP_DIR = tempRoot;
  service = new DocumentationRunsService();
});

afterEach(async () => {
  service.onModuleDestroy();
  vi.useRealTimers();
  await rm(tempRoot, {
    recursive: true,
    force: true
  });
  delete process.env.DOCS_AI_TMP_DIR;
  delete process.env.DOCS_AI_RUN_RETENTION_MS;
  delete process.env.DOCS_AI_RUN_CLEANUP_INTERVAL_MS;
});

describe('DocumentationRunsService', () => {
  it('creates a run, uploads a source, starts generation, and returns downloads', async () => {
    const created = await service.createRun({
      name: 'Fixture Docs',
      options: {
        outputFormats: ['markdown-tree', 'single-markdown', 'json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });

    const archive = new AdmZip();
    archive.addFile(
      'package.json',
      Buffer.from(
        JSON.stringify({
          scripts: {
            dev: 'next dev'
          },
          dependencies: {
            next: '^15.0.0',
            react: '^18.0.0'
          }
        })
      )
    );
    archive.addFile('app/page.tsx', Buffer.from('export default function Page() {}'));

    const uploaded = await service.uploadSources(
      created.runId,
      [
        {
          fieldname: 'frontend',
          originalname: 'frontend.zip',
          buffer: archive.toBuffer()
        }
      ],
      JSON.stringify({
        sources: [
          {
            fileField: 'frontend',
            name: 'Frontend',
            role: 'frontend'
          }
        ]
      })
    );

    expect(uploaded.status).toBe('ready');

    const started = await service.startRun(created.runId);
    expect(started.status).toBe('completed');
    const completedRun = await service.getRun(created.runId);
    expect(completedRun.progress).toEqual({
      currentStep: 'Documentation run completed',
      completedSteps: 7,
      totalSteps: 7
    });
    expect(completedRun.renderedFormats).toEqual(['markdown-tree', 'single-markdown', 'json']);

    const result = await service.getResult(created.runId);
    expect(result.documentation.pages).toHaveLength(14);
    expect(result.renderedFormats).toEqual(['markdown-tree', 'single-markdown', 'json']);

    const restartedService = new DocumentationRunsService();
    const persistedRun = await restartedService.getRun(created.runId);
    expect(persistedRun.status).toBe('completed');
    expect(persistedRun.renderedFormats).toEqual(['markdown-tree', 'single-markdown', 'json']);

    const download = await restartedService.getDownload(created.runId, 'single-markdown');
    expect(download.fileName).toBe('PROJECT_DOCUMENTATION.md');
    expect(download.content.toString()).toContain('# 01. Overview');
  });

  it('persists failed run status and safe error details', async () => {
    const created = await service.createRun({
      name: 'Broken Fixture Docs',
      options: {
        outputFormats: ['markdown-tree'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const archive = new AdmZip();
    archive.addFile('package.json', Buffer.from('{}'));

    await service.uploadSources(
      created.runId,
      [
        {
          fieldname: 'frontend',
          originalname: 'frontend.zip',
          buffer: archive.toBuffer()
        }
      ],
      JSON.stringify({
        sources: [
          {
            fileField: 'frontend',
            name: 'Frontend',
            role: 'frontend'
          }
        ]
      })
    );
    await rm(path.join(tempRoot, created.runId, 'uploads'), {
      recursive: true,
      force: true
    });

    await expect(service.startRun(created.runId)).rejects.toThrow();
    const failedRun = await service.getRun(created.runId);

    expect(failedRun.status).toBe('failed');
    expect(failedRun.error?.message).toBeTruthy();
    expect(failedRun.progress?.currentStep).toBe('Failed');
  });

  it('does not persist raw secret-bearing failure details in run state', async () => {
    const rawOpenAiKey = `sk-${'s'.repeat(24)}`;
    const created = await service.createRun({
      name: 'Secret Failure Fixture Docs',
      options: {
        outputFormats: ['single-markdown'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const archive = frontendArchive();
    (service as unknown as { engine: { generateDocumentation: () => Promise<never> } }).engine = {
      generateDocumentation: async () => {
        throw new Error(`Generation failed for ${rawOpenAiKey} from .env SHOULD_NOT_APPEAR`);
      }
    };

    await service.uploadSources(
      created.runId,
      [
        {
          fieldname: 'frontend',
          originalname: 'frontend.zip',
          buffer: archive.toBuffer()
        }
      ],
      sourceMetadata()
    );

    await expect(service.startRun(created.runId)).rejects.toThrow();
    const failedRun = await service.getRun(created.runId);
    const failurePayload = JSON.stringify(failedRun.error);

    expect(failedRun.status).toBe('failed');
    expect(failedRun.error?.message).toBe('Documentation generation failed.');
    expect(failurePayload).not.toContain(rawOpenAiKey);
    expect(failurePayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(failurePayload).not.toContain('.env');
  });

  it('lists safe run summaries without private storage or secret-bearing evidence', async () => {
    process.env.DOCS_AI_RUN_RETENTION_MS = '1000';
    service = new DocumentationRunsService();
    const rawOpenAiKey = `sk-${'p'.repeat(24)}`;
    const secretSourceName = `Frontend prefix_${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const created = await service.createRun({
      name: `Created ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const completed = await createCompletedRun('Completed Summary Docs', secretSourceName);
    const failed = await createFailedRun('Failed Summary Docs', secretSourceName);
    const expired = await createCompletedRun('Expired Summary Docs', secretSourceName);
    await setRunUpdatedAt(expired.runId, '2026-05-29T00:00:00.000Z');
    await service.cleanupExpiredRuns(new Date('2026-05-29T00:00:02.000Z'));

    const list = await service.listRuns();
    const payload = JSON.stringify(list);

    expect(list.runs.map((run) => run.id).sort()).toEqual(
      [created.runId, completed.runId, failed.runId].sort()
    );
    expect(list.runs.find((run) => run.id === created.runId)).toMatchObject({
      status: 'created',
      sourceCount: 0,
      outputFormats: ['json']
    });
    expect(list.runs.find((run) => run.id === completed.runId)).toMatchObject({
      status: 'completed',
      sourceCount: 1,
      renderedFormats: ['single-markdown']
    });
    expect(list.runs.find((run) => run.id === failed.runId)).toMatchObject({
      status: 'failed',
      sourceCount: 1,
      error: {
        message: 'Documentation generation failed.'
      }
    });
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(expired.runId);
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain(tempRoot);
    expect(payload).not.toContain('archivePath');
    expect(payload).not.toContain('tempPath');
    expect(payload).not.toContain('documentationTreePath');
    expect(payload).not.toContain('renderedPaths');
    expect(payload).not.toContain('uploads');
    expect(payload).not.toContain('extracted');
    expect(payload).not.toContain('results');
  });

  it('limits listed run summaries by latest update time', async () => {
    const oldest = await service.createRun({
      name: 'Oldest Listed Docs',
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const newest = await service.createRun({
      name: 'Newest Listed Docs',
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const middle = await service.createRun({
      name: 'Middle Listed Docs',
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    await setRunUpdatedAt(oldest.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(middle.runId, '2026-05-30T00:01:00.000Z');
    await setRunUpdatedAt(newest.runId, '2026-05-30T00:02:00.000Z');

    const list = await service.listRuns({ limit: '2' });

    expect(list.runs.map((run) => run.id)).toEqual([newest.runId, middle.runId]);
  });

  it('paginates listed run summaries with safe deterministic cursors', async () => {
    const rawOpenAiKey = `sk-${'w'.repeat(24)}`;
    const secretSourceName = `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const oldest = await createCompletedRun('Oldest Cursor Docs', secretSourceName);
    const newest = await createCompletedRun('Newest Cursor Docs', secretSourceName);
    const middle = await createCompletedRun('Middle Cursor Docs', secretSourceName);
    await setRunUpdatedAt(oldest.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(middle.runId, '2026-05-30T00:01:00.000Z');
    await setRunUpdatedAt(newest.runId, '2026-05-30T00:02:00.000Z');

    const firstPage = await service.listRuns({ limit: '2' });
    const secondPage = await service.listRuns({ limit: '2', cursor: firstPage.nextCursor });
    const firstPayload = JSON.stringify(firstPage);
    const secondPayload = JSON.stringify(secondPage);

    expect(firstPage.runs.map((run) => run.id)).toEqual([newest.runId, middle.runId]);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(firstPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(firstPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(firstPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(firstPayload).not.toContain(rawOpenAiKey);
    expect(firstPayload).not.toContain('.env');
    expect(firstPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(firstPayload).not.toContain(tempRoot);

    expect(secondPage.runs.map((run) => run.id)).toEqual([oldest.runId]);
    expect(secondPage.nextCursor).toBeUndefined();
    expect(secondPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(secondPayload).not.toContain(rawOpenAiKey);
    expect(secondPayload).not.toContain('.env');
    expect(secondPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(secondPayload).not.toContain(tempRoot);
  });

  it('filters listed run summaries by updated-at range without exposing raw values', async () => {
    const rawOpenAiKey = `sk-${'d'.repeat(24)}`;
    const secretSourceName = `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const oldest = await createCompletedRun('Oldest Updated Range Docs', secretSourceName);
    const newest = await createCompletedRun('Newest Updated Range Docs', secretSourceName);
    const middle = await createCompletedRun('Middle Updated Range Docs', secretSourceName);
    await setRunUpdatedAt(oldest.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(middle.runId, '2026-05-30T00:01:00.000Z');
    await setRunUpdatedAt(newest.runId, '2026-05-30T00:02:00.000Z');

    const list = await service.listRuns({
      updatedAfter: '2026-05-30T00:00:30.000Z',
      updatedBefore: '2026-05-30T00:01:30.000Z'
    });
    const payload = JSON.stringify(list);

    expect(list.runs.map((run) => run.id)).toEqual([middle.runId]);
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain(tempRoot);
  });

  it('filters listed run summaries by created-at range without exposing raw values', async () => {
    const rawOpenAiKey = `sk-${'l'.repeat(24)}`;
    const secretSourceName = `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const oldest = await createCompletedRun('Oldest Created Range Docs', secretSourceName);
    const newest = await createCompletedRun('Newest Created Range Docs', secretSourceName);
    const middle = await createCompletedRun('Middle Created Range Docs', secretSourceName);
    await setRunCreatedAt(oldest.runId, '2026-05-30T00:00:00.000Z');
    await setRunCreatedAt(middle.runId, '2026-05-30T00:01:00.000Z');
    await setRunCreatedAt(newest.runId, '2026-05-30T00:02:00.000Z');
    await setRunUpdatedAt(oldest.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(middle.runId, '2026-05-30T00:01:00.000Z');
    await setRunUpdatedAt(newest.runId, '2026-05-30T00:02:00.000Z');

    const list = await service.listRuns({
      createdAfter: '2026-05-30T00:00:30.000Z',
      createdBefore: '2026-05-30T00:01:30.000Z'
    });
    const payload = JSON.stringify(list);

    expect(list.runs.map((run) => run.id)).toEqual([middle.runId]);
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain(tempRoot);
  });

  it('filters listed run summaries by sanitized name with other list filters without exposing raw values', async () => {
    const rawOpenAiKey = `sk-${'f'.repeat(24)}`;
    const secretSourceName = `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const older = await createCompletedRun(
      `Older Backend Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName,
      'backend'
    );
    const newer = await createCompletedRun(
      `Completed Backend Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName,
      'backend'
    );
    await createFailedRun(
      `Failed Frontend Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName
    );
    await createCompletedRun(
      `Completed Frontend Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName,
      'frontend'
    );
    await setRunUpdatedAt(older.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(newer.runId, '2026-05-30T00:01:00.000Z');

    const firstPage = await service.listRuns({
      limit: '1',
      status: 'completed',
      role: 'backend',
      name: 'backend search',
      updatedAfter: '2026-05-29T23:59:59.000Z',
      updatedBefore: '2026-05-30T00:01:30.000Z'
    });
    const secondPage = await service.listRuns({
      limit: '1',
      status: 'completed',
      role: 'backend',
      name: 'backend search',
      updatedAfter: '2026-05-29T23:59:59.000Z',
      updatedBefore: '2026-05-30T00:01:30.000Z',
      cursor: firstPage.nextCursor
    });
    const payload = JSON.stringify({ firstPage, secondPage });

    expect(firstPage.runs.map((run) => run.id)).toEqual([newer.runId]);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(secondPage.runs.map((run) => run.id)).toEqual([older.runId]);
    expect(secondPage.nextCursor).toBeUndefined();
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain(tempRoot);
  });

  it('filters listed run summaries by output format with other list filters without exposing raw values', async () => {
    const rawOpenAiKey = `sk-${'h'.repeat(24)}`;
    const secretSourceName = `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const older = await createCompletedRun(
      `Older Backend Format Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName,
      'backend',
      ['json']
    );
    const newer = await createCompletedRun(
      `Completed Backend Format Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName,
      'backend',
      ['json']
    );
    await createCompletedRun(
      `Markdown Backend Format Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName,
      'backend'
    );
    await createCompletedRun(
      `Completed Frontend Format Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName,
      'frontend',
      ['json']
    );
    await setRunUpdatedAt(older.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(newer.runId, '2026-05-30T00:01:00.000Z');

    const firstPage = await service.listRuns({
      limit: '1',
      status: 'completed',
      role: 'backend',
      name: 'backend format search',
      format: 'json',
      updatedAfter: '2026-05-29T23:59:59.000Z',
      updatedBefore: '2026-05-30T00:01:30.000Z'
    });
    const secondPage = await service.listRuns({
      limit: '1',
      status: 'completed',
      role: 'backend',
      name: 'backend format search',
      format: 'json',
      updatedAfter: '2026-05-29T23:59:59.000Z',
      updatedBefore: '2026-05-30T00:01:30.000Z',
      cursor: firstPage.nextCursor
    });
    const payload = JSON.stringify({ firstPage, secondPage });

    expect(firstPage.runs.map((run) => run.id)).toEqual([newer.runId]);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(secondPage.runs.map((run) => run.id)).toEqual([older.runId]);
    expect(secondPage.nextCursor).toBeUndefined();
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain(tempRoot);
  });

  it('filters listed run summaries by source count with other list filters without exposing raw values', async () => {
    const rawOpenAiKey = `sk-${'j'.repeat(24)}`;
    const older = await createCompletedRun(
      `Older Backend Source Count Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      'backend',
      ['json']
    );
    const newer = await createCompletedRun(
      `Completed Backend Source Count Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      'backend',
      ['json']
    );
    await service.createRun({
      name: `Zero Source Count Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    await createCompletedRun(
      `Frontend Source Count Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      'frontend',
      ['json']
    );
    await setRunUpdatedAt(older.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(newer.runId, '2026-05-30T00:01:00.000Z');

    const firstPage = await service.listRuns({
      limit: '1',
      status: 'completed',
      role: 'backend',
      name: 'backend source count search',
      format: 'json',
      minSources: '1',
      maxSources: '1',
      updatedAfter: '2026-05-29T23:59:59.000Z',
      updatedBefore: '2026-05-30T00:01:30.000Z'
    });
    const secondPage = await service.listRuns({
      limit: '1',
      status: 'completed',
      role: 'backend',
      name: 'backend source count search',
      format: 'json',
      minSources: '1',
      maxSources: '1',
      updatedAfter: '2026-05-29T23:59:59.000Z',
      updatedBefore: '2026-05-30T00:01:30.000Z',
      cursor: firstPage.nextCursor
    });
    const payload = JSON.stringify({ firstPage, secondPage });

    expect(firstPage.runs.map((run) => run.id)).toEqual([newer.runId]);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(secondPage.runs.map((run) => run.id)).toEqual([older.runId]);
    expect(secondPage.nextCursor).toBeUndefined();
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain(tempRoot);
  });

  it('rejects invalid run listing limits without echoing raw values', async () => {
    const rawOpenAiKey = `sk-${'z'.repeat(24)}`;
    const rawLimit = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    await expect(service.listRuns({ limit: rawLimit })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_LIMIT_INVALID',
        message: 'Run list limit must be an integer between 1 and 100.',
        details: {
          min: 1,
          max: 100
        }
      }
    });

    try {
      await service.listRuns({ limit: rawLimit });
      throw new Error('Expected listRuns to reject invalid limit.');
    } catch (error) {
      const payload = JSON.stringify(error);
      expect(payload).not.toContain(rawLimit);
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('filters listed run summaries by status without exposing raw values', async () => {
    const rawOpenAiKey = `sk-${'s'.repeat(24)}`;
    const secretSourceName = `Backend .env SHOULD_NOT_APPEAR ${rawOpenAiKey}`;
    await service.createRun({
      name: `Created ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    await createCompletedRun('Completed Filter Docs', secretSourceName);
    const failed = await createFailedRun('Failed Filter Docs', secretSourceName);

    const list = await service.listRuns({ status: 'failed' });
    const payload = JSON.stringify(list);

    expect(list.runs.map((run) => run.id)).toEqual([failed.runId]);
    expect(list.runs[0]).toMatchObject({
      status: 'failed',
      sourceCount: 1,
      error: {
        message: 'Documentation generation failed.'
      }
    });
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain(tempRoot);
    expect(payload).not.toContain('archivePath');
    expect(payload).not.toContain('tempPath');
    expect(payload).not.toContain('documentationTreePath');
    expect(payload).not.toContain('renderedPaths');
  });

  it('rejects invalid run listing statuses without echoing raw values', async () => {
    const rawOpenAiKey = `sk-${'t'.repeat(24)}`;
    const rawStatus = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    await expect(service.listRuns({ status: rawStatus })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_STATUS_INVALID',
        message: 'Run list status must be a supported documentation run status.',
        details: {
          allowedStatuses: expect.arrayContaining(['created', 'completed', 'failed'])
        }
      }
    });

    try {
      await service.listRuns({ status: rawStatus });
      throw new Error('Expected listRuns to reject invalid status.');
    } catch (error) {
      const payload = JSON.stringify(error);
      expect(payload).not.toContain(rawStatus);
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('filters listed run summaries by source role without exposing raw values', async () => {
    const rawOpenAiKey = `sk-${'u'.repeat(24)}`;
    const frontendName = `Frontend .env SHOULD_NOT_APPEAR ${rawOpenAiKey}`;
    const backendName = `Backend .env SHOULD_NOT_APPEAR ${rawOpenAiKey}`;
    await createCompletedRun('Frontend Role Filter Docs', frontendName, 'frontend');
    const backend = await createCompletedRun('Backend Role Filter Docs', backendName, 'backend');

    const list = await service.listRuns({ role: 'backend' });
    const payload = JSON.stringify(list);

    expect(list.runs.map((run) => run.id)).toEqual([backend.runId]);
    expect(list.runs[0]).toMatchObject({
      status: 'completed',
      sourceCount: 1,
      sources: [
        {
          role: 'backend'
        }
      ],
      renderedFormats: ['single-markdown']
    });
    expect(payload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(payload).toContain('[REDACTED_DENIED_FILE]');
    expect(payload).toContain('[REDACTED_DENIED_VALUE]');
    expect(payload).not.toContain(rawOpenAiKey);
    expect(payload).not.toContain('.env');
    expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    expect(payload).not.toContain(tempRoot);
    expect(payload).not.toContain('archivePath');
    expect(payload).not.toContain('tempPath');
    expect(payload).not.toContain('documentationTreePath');
    expect(payload).not.toContain('renderedPaths');
  });

  it('rejects invalid run listing source roles without echoing raw values', async () => {
    const rawOpenAiKey = `sk-${'v'.repeat(24)}`;
    const rawRole = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    await expect(service.listRuns({ role: rawRole })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_SOURCE_ROLE_INVALID',
        message: 'Run list source role must be a supported source role.',
        details: {
          allowedRoles: expect.arrayContaining(['frontend', 'backend', 'unknown'])
        }
      }
    });

    try {
      await service.listRuns({ role: rawRole });
      throw new Error('Expected listRuns to reject invalid source role.');
    } catch (error) {
      const payload = JSON.stringify(error);
      expect(payload).not.toContain(rawRole);
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('rejects invalid run listing cursors without echoing raw values', async () => {
    const rawOpenAiKey = `sk-${'x'.repeat(24)}`;
    const rawCursor = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    await expect(service.listRuns({ cursor: rawCursor })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_CURSOR_INVALID',
        message: 'Run list cursor is invalid.'
      }
    });

    try {
      await service.listRuns({ cursor: rawCursor });
      throw new Error('Expected listRuns to reject invalid cursor.');
    } catch (error) {
      const payload = JSON.stringify(error);
      expect(payload).not.toContain(rawCursor);
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('rejects invalid run listing updated-at filters without echoing raw values', async () => {
    const rawOpenAiKey = `sk-${'e'.repeat(24)}`;
    const rawTimestamp = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    await expect(service.listRuns({ updatedAfter: rawTimestamp })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_UPDATED_AFTER_INVALID',
        message: 'Run list updatedAfter must be a valid ISO timestamp.'
      }
    });
    await expect(service.listRuns({ updatedBefore: rawTimestamp })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_UPDATED_BEFORE_INVALID',
        message: 'Run list updatedBefore must be a valid ISO timestamp.'
      }
    });

    for (const options of [{ updatedAfter: rawTimestamp }, { updatedBefore: rawTimestamp }]) {
      try {
        await service.listRuns(options);
        throw new Error('Expected listRuns to reject invalid updated-at filter.');
      } catch (error) {
        const payload = JSON.stringify(error);
        expect(payload).not.toContain(rawTimestamp);
        expect(payload).not.toContain(rawOpenAiKey);
        expect(payload).not.toContain('.env');
        expect(payload).not.toContain('SHOULD_NOT_APPEAR');
      }
    }
  });

  it('rejects invalid run listing created-at filters without echoing raw values', async () => {
    const rawOpenAiKey = `sk-${'m'.repeat(24)}`;
    const rawTimestamp = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    await expect(service.listRuns({ createdAfter: rawTimestamp })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_CREATED_AFTER_INVALID',
        message: 'Run list createdAfter must be a valid ISO timestamp.'
      }
    });
    await expect(service.listRuns({ createdBefore: rawTimestamp })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_CREATED_BEFORE_INVALID',
        message: 'Run list createdBefore must be a valid ISO timestamp.'
      }
    });

    for (const options of [{ createdAfter: rawTimestamp }, { createdBefore: rawTimestamp }]) {
      try {
        await service.listRuns(options);
        throw new Error('Expected listRuns to reject invalid created-at filter.');
      } catch (error) {
        const payload = JSON.stringify(error);
        expect(payload).not.toContain(rawTimestamp);
        expect(payload).not.toContain(rawOpenAiKey);
        expect(payload).not.toContain('.env');
        expect(payload).not.toContain('SHOULD_NOT_APPEAR');
      }
    }
  });

  it('rejects invalid run listing name filters without echoing raw values', async () => {
    const rawOpenAiKey = `sk-${'g'.repeat(24)}`;
    const rawName = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;
    const longRawName = rawName.repeat(5);

    await expect(service.listRuns({ name: '   ' })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_NAME_INVALID',
        message: 'Run list name filter must be between 1 and 200 characters.'
      }
    });
    await expect(service.listRuns({ name: longRawName })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_NAME_INVALID',
        message: 'Run list name filter must be between 1 and 200 characters.'
      }
    });

    try {
      await service.listRuns({ name: longRawName });
      throw new Error('Expected listRuns to reject invalid name filter.');
    } catch (error) {
      const payload = JSON.stringify(error);
      expect(payload).not.toContain(longRawName);
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('rejects invalid run listing format filters without echoing raw values', async () => {
    const rawOpenAiKey = `sk-${'i'.repeat(24)}`;
    const rawFormat = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    await expect(service.listRuns({ format: rawFormat })).rejects.toMatchObject({
      response: {
        code: 'RUN_LIST_FORMAT_INVALID',
        message: 'Run list format must be a supported documentation output format.',
        details: {
          allowedFormats: expect.arrayContaining(['markdown-tree', 'single-markdown', 'json'])
        }
      }
    });

    try {
      await service.listRuns({ format: rawFormat });
      throw new Error('Expected listRuns to reject invalid format filter.');
    } catch (error) {
      const payload = JSON.stringify(error);
      expect(payload).not.toContain(rawFormat);
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('rejects invalid run listing source count filters without echoing raw values', async () => {
    const rawOpenAiKey = `sk-${'k'.repeat(24)}`;
    const rawSourceCount = `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`;

    for (const options of [
      { minSources: rawSourceCount },
      { maxSources: rawSourceCount },
      { minSources: '2', maxSources: '1' }
    ]) {
      await expect(service.listRuns(options)).rejects.toMatchObject({
        response: {
          code: 'RUN_LIST_SOURCE_COUNT_INVALID',
          message:
            'Run list source count filters must be non-negative integers, and minSources must not exceed maxSources.',
          details: {
            min: 0
          }
        }
      });

      try {
        await service.listRuns(options);
        throw new Error('Expected listRuns to reject invalid source count filter.');
      } catch (error) {
        const payload = JSON.stringify(error);
        expect(payload).not.toContain(rawSourceCount);
        expect(payload).not.toContain(rawOpenAiKey);
        expect(payload).not.toContain('.env');
        expect(payload).not.toContain('SHOULD_NOT_APPEAR');
      }
    }
  });

  it('rejects source uploads and restarts after completion', async () => {
    const created = await service.createRun({
      name: 'Completed Fixture Docs',
      options: {
        outputFormats: ['single-markdown'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const archive = frontendArchive();

    await service.uploadSources(
      created.runId,
      [
        {
          fieldname: 'frontend',
          originalname: 'frontend.zip',
          buffer: archive.toBuffer()
        }
      ],
      sourceMetadata()
    );
    await service.startRun(created.runId);

    await expect(
      service.uploadSources(
        created.runId,
        [
          {
            fieldname: 'frontend',
            originalname: 'frontend.zip',
            buffer: archive.toBuffer()
          }
        ],
        sourceMetadata()
      )
    ).rejects.toMatchObject({
      response: {
        code: 'RUN_SOURCE_UPLOAD_NOT_ALLOWED'
      }
    });
    await expect(service.startRun(created.runId)).rejects.toMatchObject({
      response: {
        code: 'RUN_START_NOT_ALLOWED'
      }
    });
  });

  it('rejects unsupported source archive file types before storing uploads', async () => {
    const created = await service.createRun({
      name: 'Unsupported Archive Fixture Docs',
      options: {
        outputFormats: ['single-markdown'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });

    await expect(
      service.uploadSources(
        created.runId,
        [
          {
            fieldname: 'frontend',
            originalname: 'frontend.txt',
            buffer: Buffer.from('not an archive')
          }
        ],
        sourceMetadata()
      )
    ).rejects.toMatchObject({
      response: {
        code: 'SOURCE_ARCHIVE_UNSUPPORTED_TYPE'
      }
    });
    await expect(readdir(path.join(tempRoot, created.runId, 'uploads'))).rejects.toThrow();
  });

  it('cleans old source artifacts when replacing ready-state uploads', async () => {
    const created = await service.createRun({
      name: 'Replace Sources Fixture Docs',
      options: {
        outputFormats: ['single-markdown'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    await service.uploadSources(
      created.runId,
      [
        {
          fieldname: 'frontend',
          originalname: 'frontend-a.zip',
          buffer: frontendArchive().toBuffer()
        }
      ],
      sourceMetadata()
    );
    const uploadPath = path.join(tempRoot, created.runId, 'uploads');
    expect(await readdir(uploadPath)).toHaveLength(1);

    await service.uploadSources(
      created.runId,
      [
        {
          fieldname: 'frontend',
          originalname: 'frontend-b.zip',
          buffer: frontendArchive().toBuffer()
        }
      ],
      sourceMetadata()
    );

    const uploads = await readdir(uploadPath);
    expect(uploads).toHaveLength(1);
    expect(uploads[0]).toContain('frontend-b.zip');
    expect((await service.getRun(created.runId)).renderedFormats).toBeUndefined();
  });

  it('cleans up expired run artifacts from the temp store', async () => {
    process.env.DOCS_AI_RUN_RETENTION_MS = '1000';
    service = new DocumentationRunsService();
    const created = await service.createRun({
      name: 'Expired Docs',
      options: {
        outputFormats: ['markdown-tree'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const manifestPath = path.join(tempRoot, created.runId, 'run.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      run: {
        updatedAt: string;
      };
    };
    manifest.run.updatedAt = '2026-05-29T00:00:00.000Z';
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    const cleanup = await service.cleanupExpiredRuns(new Date('2026-05-29T00:00:02.000Z'));

    expect(cleanup.deletedRunIds).toEqual([created.runId]);
    await expect(service.getRun(created.runId)).rejects.toThrow();
  });

  it('uses fallback retention when retention configuration is invalid', async () => {
    process.env.DOCS_AI_RUN_RETENTION_MS = 'invalid';
    service = new DocumentationRunsService();
    const completed = await createCompletedRun('Invalid Retention Docs');
    await setRunUpdatedAt(completed.runId, '2026-05-29T00:00:00.000Z');

    const cleanup = await service.cleanupExpiredRuns(new Date('2026-05-29T00:00:02.000Z'));

    expect(cleanup.deletedRunIds).toEqual([]);
    await expect(service.getRun(completed.runId)).resolves.toMatchObject({
      id: completed.runId,
      status: 'completed'
    });
  });

  it('expires runs immediately when retention is configured as zero', async () => {
    process.env.DOCS_AI_RUN_RETENTION_MS = '0';
    service = new DocumentationRunsService();
    const completed = await createCompletedRun('Immediate Retention Docs');
    await setRunUpdatedAt(completed.runId, '2026-05-29T00:00:00.000Z');

    const cleanup = await service.cleanupExpiredRuns(new Date('2026-05-29T00:00:00.000Z'));

    expect(cleanup.deletedRunIds).toEqual([completed.runId]);
    await expect(service.getRun(completed.runId)).rejects.toThrow();
  });

  it('expires completed, failed, and abandoned runs without leaving stale artifacts', async () => {
    process.env.DOCS_AI_RUN_RETENTION_MS = '1000';
    service = new DocumentationRunsService();
    const completed = await createCompletedRun('Completed Expiration Docs');
    const failed = await createFailedRun('Failed Expiration Docs');
    const abandoned = await service.createRun({
      name: 'Abandoned Expiration Docs',
      options: {
        outputFormats: ['single-markdown'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const fresh = await createCompletedRun('Fresh Expiration Docs');

    await setRunUpdatedAt(completed.runId, '2026-05-29T00:00:00.000Z');
    await setRunUpdatedAt(failed.runId, '2026-05-29T00:00:00.000Z');
    await setRunUpdatedAt(abandoned.runId, '2026-05-29T00:00:00.000Z');
    await setRunUpdatedAt(fresh.runId, '2026-05-29T00:00:01.500Z');

    const cleanup = await service.cleanupExpiredRuns(new Date('2026-05-29T00:00:02.000Z'));

    expect(cleanup.deletedRunIds).toEqual(
      [abandoned.runId, completed.runId, failed.runId].sort((left, right) =>
        left.localeCompare(right)
      )
    );
    await expect(readdir(path.join(tempRoot, completed.runId))).rejects.toThrow();
    await expect(readdir(path.join(tempRoot, failed.runId))).rejects.toThrow();
    await expect(readdir(path.join(tempRoot, abandoned.runId))).rejects.toThrow();
    await expect(service.getRun(completed.runId)).rejects.toMatchObject({
      response: {
        code: 'DOCUMENTATION_RUN_NOT_FOUND',
        message: `Documentation run was not found: ${completed.runId}.`
      }
    });
    await expect(service.getResult(completed.runId)).rejects.toMatchObject({
      response: {
        code: 'DOCUMENTATION_RUN_NOT_FOUND'
      }
    });
    await expect(service.getDownload(completed.runId, 'single-markdown')).rejects.toMatchObject({
      response: {
        code: 'DOCUMENTATION_RUN_NOT_FOUND'
      }
    });
    await expect(service.getRun(fresh.runId)).resolves.toMatchObject({
      id: fresh.runId,
      status: 'completed'
    });
  });

  it('continues expired run cleanup when one run directory removal fails', async () => {
    process.env.DOCS_AI_RUN_RETENTION_MS = '1000';
    service = new DocumentationRunsService();
    const blocked = await createCompletedRun('Blocked Cleanup Docs');
    const removable = await createCompletedRun('Removable Cleanup Docs');
    await setRunUpdatedAt(blocked.runId, '2026-05-29T00:00:00.000Z');
    await setRunUpdatedAt(removable.runId, '2026-05-29T00:00:00.000Z');
    const rawOpenAiKey = `sk-${'r'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    const internals = service as unknown as {
      logger: { warn: (message: string) => void };
      removeRunDirectory: (storedRun: { run: { id: string }; tempPath: string }) => Promise<void>;
    };
    const removeRunDirectory = internals.removeRunDirectory.bind(service);
    vi.spyOn(internals, 'removeRunDirectory').mockImplementation(async (storedRun) => {
      if (storedRun.run.id === blocked.runId) {
        throw new Error(`Cleanup failed while removing ${rawStoragePath}.`);
      }

      await removeRunDirectory(storedRun);
    });
    const warn = vi.spyOn(internals.logger, 'warn').mockImplementation(() => undefined);

    const cleanup = await service.cleanupExpiredRuns(new Date('2026-05-29T00:00:02.000Z'));

    expect(cleanup.deletedRunIds).toEqual([removable.runId]);
    await expect(readdir(path.join(tempRoot, blocked.runId))).resolves.toEqual(
      expect.arrayContaining(['run.json'])
    );
    await expect(readdir(path.join(tempRoot, removable.runId))).rejects.toThrow();
    const message = String(warn.mock.calls[0]?.[0] ?? '');
    expect(message).toContain(blocked.runId);
    expect(message).toContain('[REDACTED_STORAGE_PATH]');
    expect(message).not.toContain(rawStoragePath);
    expect(message).not.toContain('/private/tmp');
    expect(message).not.toContain(rawOpenAiKey);
    expect(message).not.toContain('.env');
    expect(message).not.toContain('SHOULD_NOT_APPEAR');
  });

  it('returns safe errors when persisted result artifacts are missing', async () => {
    const rawOpenAiKey = `sk-${'x'.repeat(24)}`;
    const completed = await createCompletedRun('Missing Artifact Docs');
    const manifestPath = path.join(tempRoot, completed.runId, 'run.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
      documentationTreePath: string;
      renderedPaths: {
        'single-markdown': string;
      };
    };
    manifest.documentationTreePath = path.join(
      tempRoot,
      `prefix_${rawOpenAiKey}`,
      '.env',
      'SHOULD_NOT_APPEAR-documentation-tree.json'
    );
    manifest.renderedPaths['single-markdown'] = path.join(
      tempRoot,
      `prefix_${rawOpenAiKey}`,
      '.env',
      'SHOULD_NOT_APPEAR-rendered-single-markdown.json'
    );
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

    await expect(service.getResult(completed.runId)).rejects.toMatchObject({
      response: {
        code: 'DOCUMENTATION_RESULT_ARTIFACT_MISSING',
        message: 'Documentation result artifact is unavailable.'
      }
    });
    await expect(service.getDownload(completed.runId, 'single-markdown')).rejects.toMatchObject({
      response: {
        code: 'DOCUMENTATION_DOWNLOAD_ARTIFACT_MISSING',
        message: 'Documentation download artifact is unavailable.'
      }
    });

    await expectSafeMissingArtifactError(service.getResult(completed.runId), rawOpenAiKey);
    await expectSafeMissingArtifactError(
      service.getDownload(completed.runId, 'single-markdown'),
      rawOpenAiKey
    );
  });

  it('runs expired run cleanup when the module starts and on the configured interval', async () => {
    process.env.DOCS_AI_RUN_CLEANUP_INTERVAL_MS = '1000';
    service = new DocumentationRunsService();
    vi.useFakeTimers();
    const cleanupExpiredRuns = vi.spyOn(service, 'cleanupExpiredRuns').mockResolvedValue({
      deletedRunIds: []
    });

    await service.onModuleInit();
    await vi.advanceTimersByTimeAsync(1000);

    expect(cleanupExpiredRuns).toHaveBeenCalledTimes(2);
  });

  it('sanitizes expired run cleanup warning logs', async () => {
    const rawOpenAiKey = `sk-${'l'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    process.env.DOCS_AI_RUN_CLEANUP_INTERVAL_MS = '1000';
    service = new DocumentationRunsService();
    vi.useFakeTimers();
    vi.spyOn(service, 'cleanupExpiredRuns').mockRejectedValue(
      new Error(`Cleanup failed while removing ${rawStoragePath}.`)
    );
    const warn = vi
      .spyOn(
        (service as unknown as { logger: { warn: (message: string) => void } }).logger,
        'warn'
      )
      .mockImplementation(() => undefined);

    await service.onModuleInit();

    const message = String(warn.mock.calls[0]?.[0] ?? '');
    expect(message).toContain('[REDACTED_STORAGE_PATH]');
    expect(message).not.toContain(rawStoragePath);
    expect(message).not.toContain('/private/tmp');
    expect(message).not.toContain(rawOpenAiKey);
    expect(message).not.toContain('.env');
    expect(message).not.toContain('SHOULD_NOT_APPEAR');
  });

  it('continues scheduled cleanup after startup and interval cleanup failures', async () => {
    const rawOpenAiKey = `sk-${'s'.repeat(24)}`;
    const rawStoragePath = `/private/tmp/codebase-docs-ai/prefix_${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR/run.json`;
    process.env.DOCS_AI_RUN_CLEANUP_INTERVAL_MS = '1000';
    service = new DocumentationRunsService();
    vi.useFakeTimers();
    const cleanupExpiredRuns = vi
      .spyOn(service, 'cleanupExpiredRuns')
      .mockRejectedValueOnce(new Error(`Startup cleanup failed at ${rawStoragePath}.`))
      .mockRejectedValueOnce(new Error(`Interval cleanup failed at ${rawStoragePath}.`))
      .mockResolvedValue({
        deletedRunIds: []
      });
    const warn = vi
      .spyOn(
        (service as unknown as { logger: { warn: (message: string) => void } }).logger,
        'warn'
      )
      .mockImplementation(() => undefined);

    await service.onModuleInit();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(1000);

    expect(cleanupExpiredRuns).toHaveBeenCalledTimes(3);
    expect(warn).toHaveBeenCalledTimes(2);
    for (const [message] of warn.mock.calls) {
      const payload = String(message);
      expect(payload).toContain('[REDACTED_STORAGE_PATH]');
      expect(payload).not.toContain(rawStoragePath);
      expect(payload).not.toContain('/private/tmp');
      expect(payload).not.toContain(rawOpenAiKey);
      expect(payload).not.toContain('.env');
      expect(payload).not.toContain('SHOULD_NOT_APPEAR');
    }
  });

  it('does not schedule expired run cleanup when the interval is disabled', async () => {
    process.env.DOCS_AI_RUN_CLEANUP_INTERVAL_MS = '0';
    service = new DocumentationRunsService();
    vi.useFakeTimers();
    const cleanupExpiredRuns = vi.spyOn(service, 'cleanupExpiredRuns').mockResolvedValue({
      deletedRunIds: []
    });

    await service.onModuleInit();
    await vi.advanceTimersByTimeAsync(5000);

    expect(cleanupExpiredRuns).not.toHaveBeenCalled();
  });

  it('uses fallback cleanup interval when interval configuration is invalid', async () => {
    process.env.DOCS_AI_RUN_CLEANUP_INTERVAL_MS = 'invalid';
    service = new DocumentationRunsService();
    vi.useFakeTimers();
    const cleanupExpiredRuns = vi.spyOn(service, 'cleanupExpiredRuns').mockResolvedValue({
      deletedRunIds: []
    });

    await service.onModuleInit();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

    expect(cleanupExpiredRuns).toHaveBeenCalledTimes(2);
  });

  it('clears the expired run cleanup interval when the module shuts down', async () => {
    process.env.DOCS_AI_RUN_CLEANUP_INTERVAL_MS = '1000';
    service = new DocumentationRunsService();
    vi.useFakeTimers();
    const cleanupExpiredRuns = vi.spyOn(service, 'cleanupExpiredRuns').mockResolvedValue({
      deletedRunIds: []
    });

    await service.onModuleInit();
    service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(3000);

    expect(cleanupExpiredRuns).toHaveBeenCalledTimes(1);
  });
});

function frontendArchive(): AdmZip {
  const archive = new AdmZip();
  archive.addFile(
    'package.json',
    Buffer.from(
      JSON.stringify({
        scripts: {
          dev: 'next dev'
        },
        dependencies: {
          next: '^15.0.0',
          react: '^18.0.0'
        }
      })
    )
  );
  archive.addFile('app/page.tsx', Buffer.from('export default function Page() {}'));
  return archive;
}

function sourceMetadata(name = 'Frontend', role = 'frontend'): string {
  return JSON.stringify({
    sources: [
      {
        fileField: 'frontend',
        name,
        role
      }
    ]
  });
}

async function createCompletedRun(
  name: string,
  sourceName = 'Frontend',
  role = 'frontend',
  outputFormats: Array<'markdown-tree' | 'single-markdown' | 'json'> = ['single-markdown']
): Promise<{ runId: string }> {
  const created = await service.createRun({
    name,
    options: {
      outputFormats,
      language: 'en',
      includeSourceReferences: true,
      includeWarnings: true
    }
  });
  await service.uploadSources(
    created.runId,
    [
      {
        fieldname: 'frontend',
        originalname: 'frontend.zip',
        buffer: frontendArchive().toBuffer()
      }
    ],
    sourceMetadata(sourceName, role)
  );
  await service.startRun(created.runId);
  return {
    runId: created.runId
  };
}

async function createFailedRun(name: string, sourceName = 'Frontend'): Promise<{ runId: string }> {
  const created = await service.createRun({
    name,
    options: {
      outputFormats: ['single-markdown'],
      language: 'en',
      includeSourceReferences: true,
      includeWarnings: true
    }
  });
  await service.uploadSources(
    created.runId,
    [
      {
        fieldname: 'frontend',
        originalname: 'frontend.zip',
        buffer: frontendArchive().toBuffer()
      }
    ],
    sourceMetadata(sourceName)
  );
  await rm(path.join(tempRoot, created.runId, 'uploads'), {
    recursive: true,
    force: true
  });
  await expect(service.startRun(created.runId)).rejects.toThrow();
  return {
    runId: created.runId
  };
}

async function setRunUpdatedAt(runId: string, updatedAt: string): Promise<void> {
  const manifestPath = path.join(tempRoot, runId, 'run.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    run: {
      updatedAt: string;
    };
  };
  manifest.run.updatedAt = updatedAt;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function setRunCreatedAt(runId: string, createdAt: string): Promise<void> {
  const manifestPath = path.join(tempRoot, runId, 'run.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    run: {
      createdAt: string;
    };
  };
  manifest.run.createdAt = createdAt;
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

async function expectSafeMissingArtifactError(
  action: Promise<unknown>,
  rawOpenAiKey: string
): Promise<void> {
  let caughtError: unknown;
  try {
    await action;
  } catch (error) {
    caughtError = error;
  }

  expect(caughtError).toBeDefined();
  const payload = JSON.stringify(caughtError);
  expect(payload).not.toContain(rawOpenAiKey);
  expect(payload).not.toContain('SHOULD_NOT_APPEAR');
  expect(payload).not.toContain('.env');
}
