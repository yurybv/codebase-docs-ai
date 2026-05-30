import 'reflect-metadata';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from './app-bootstrap.js';
import { AppModule } from './app.module.js';
import { DocumentationRunsService } from './documentation-runs.service.js';

let app: INestApplication;
let apiBaseUrl: string;
let tempRoot: string;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-api-http-'));
  process.env.DOCS_AI_TMP_DIR = tempRoot;
  app = await NestFactory.create(AppModule, {
    logger: false
  });
  configureApp(app);
  await app.listen(0);
  apiBaseUrl = await app.getUrl();
});

afterEach(async () => {
  await app.close();
  await rm(tempRoot, {
    recursive: true,
    force: true
  });
  delete process.env.DOCS_AI_TMP_DIR;
});

describe('Documentation runs HTTP API', () => {
  it('returns the public error envelope for invalid requests', async () => {
    const response = await fetch(`${apiBaseUrl}/v1/documentation-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'INVALID_DOCUMENTATION_RUN',
        message: 'Documentation run request is invalid.'
      }
    });
  });

  it('returns a safe error envelope for unsupported source archive uploads', async () => {
    const created = await fetchJson<{ runId: string }>(`${apiBaseUrl}/v1/documentation-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: 'Unsupported Upload Documentation',
        options: {
          outputFormats: ['single-markdown'],
          language: 'en',
          includeSourceReferences: true,
          includeWarnings: true
        }
      })
    });
    const formData = new FormData();
    formData.append(
      'metadata',
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
    formData.append('frontend', new Blob(['not an archive']), 'frontend.txt');

    const response = await fetch(`${apiBaseUrl}/v1/documentation-runs/${created.runId}/sources`, {
      method: 'POST',
      body: formData
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'SOURCE_ARCHIVE_UNSUPPORTED_TYPE',
        message: 'Unsupported source archive type: frontend.txt.'
      }
    });
  });

  it('runs the create, upload, start, result, download, and delete lifecycle', async () => {
    const created = await fetchJson<{ runId: string; status: string }>(
      `${apiBaseUrl}/v1/documentation-runs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'HTTP Lifecycle Documentation',
          options: {
            outputFormats: ['single-markdown', 'json'],
            language: 'en',
            includeSourceReferences: true,
            includeWarnings: true
          }
        })
      }
    );
    expect(created.status).toBe('created');

    const formData = new FormData();
    formData.append(
      'metadata',
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
    formData.append('frontend', await archiveBlob(), 'frontend.zip');

    const uploaded = await fetchJson<{ status: string; sources: unknown[] }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/sources`,
      {
        method: 'POST',
        body: formData
      }
    );
    expect(uploaded.status).toBe('ready');
    expect(uploaded.sources).toHaveLength(1);

    const started = await fetchJson<{ status: string }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/start`,
      {
        method: 'POST'
      }
    );
    expect(started.status).toBe('completed');

    const completedRun = await fetchJson<{ renderedFormats: string[] }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}`
    );
    expect(completedRun.renderedFormats).toEqual(['single-markdown', 'json']);

    const result = await fetchJson<{
      renderedFormats: string[];
      documentation: { pages: unknown[] };
    }>(`${apiBaseUrl}/v1/documentation-runs/${created.runId}/result`);
    expect(result.documentation.pages.length).toBeGreaterThan(0);
    expect(result.renderedFormats).toEqual(['single-markdown', 'json']);

    const downloadResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=single-markdown`
    );
    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get('content-type')).toContain('text/markdown');
    await expect(downloadResponse.text()).resolves.toContain('# 01. Overview');

    const deleted = await fetchJson<{ deleted: boolean }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}`,
      {
        method: 'DELETE'
      }
    );
    expect(deleted.deleted).toBe(true);

    const missingRunResponse = await fetch(`${apiBaseUrl}/v1/documentation-runs/${created.runId}`);
    expect(missingRunResponse.status).toBe(404);
    await expect(missingRunResponse.json()).resolves.toMatchObject({
      error: {
        code: 'DOCUMENTATION_RUN_NOT_FOUND'
      }
    });
  });

  it('lists safe run summaries without persisted artifact or upload storage paths', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'q'.repeat(24)}`;
    const secretSourceName = `Frontend prefix_${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const created = await service.createRun({
      name: `HTTP Created ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const completed = await createServiceRun(service, 'HTTP Listed Completed Docs', secretSourceName);
    const failed = await createServiceRun(service, 'HTTP Listed Failed Docs', secretSourceName, {
      failBeforeStart: true
    });
    const expired = await createServiceRun(service, 'HTTP Listed Expired Docs', secretSourceName);
    await setRunUpdatedAt(expired.runId, '2026-05-01T00:00:00.000Z');
    await service.cleanupExpiredRuns(new Date('2026-05-30T00:00:00.000Z'));

    const response = await fetch(`${apiBaseUrl}/v1/documentation-runs`);
    const payload = await response.text();
    const list = JSON.parse(payload) as {
      runs: Array<{
        id: string;
        status: string;
        sourceCount: number;
        renderedFormats?: string[];
        error?: { message: string };
      }>;
    };

    expect(response.status).toBe(200);
    expect(list.runs.map((run) => run.id).sort()).toEqual(
      [created.runId, completed.runId, failed.runId].sort()
    );
    expect(list.runs.find((run) => run.id === created.runId)).toMatchObject({
      status: 'created',
      sourceCount: 0
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

  it('validates and applies the run list limit query parameter', async () => {
    const service = app.get(DocumentationRunsService);
    const oldest = await service.createRun({
      name: 'HTTP Oldest Listed Docs',
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const newest = await service.createRun({
      name: 'HTTP Newest Listed Docs',
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const middle = await service.createRun({
      name: 'HTTP Middle Listed Docs',
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

    const limited = await fetchJson<{ runs: Array<{ id: string }> }>(
      `${apiBaseUrl}/v1/documentation-runs?limit=2`
    );
    expect(limited.runs.map((run) => run.id)).toEqual([newest.runId, middle.runId]);

    const rawOpenAiKey = `sk-${'z'.repeat(24)}`;
    const invalidLimit = encodeURIComponent(
      `/private/tmp/codebase-docs-ai/${rawOpenAiKey}/.env/SHOULD_NOT_APPEAR`
    );
    const invalidResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=${invalidLimit}`
    );
    const invalidPayload = await invalidResponse.text();

    expect(invalidResponse.status).toBe(400);
    expect(invalidPayload).toContain('RUN_LIST_LIMIT_INVALID');
    expect(invalidPayload).not.toContain(rawOpenAiKey);
    expect(invalidPayload).not.toContain('.env');
    expect(invalidPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidPayload).not.toContain('/private/tmp');
  });

  it('paginates run list responses with safe cursor query parameters', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'w'.repeat(24)}`;
    const oldest = await service.createRun({
      name: `HTTP Oldest Cursor ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const newest = await service.createRun({
      name: `HTTP Newest Cursor ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const middle = await service.createRun({
      name: `HTTP Middle Cursor ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
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

    const firstResponse = await fetch(`${apiBaseUrl}/v1/documentation-runs?limit=2`);
    const firstPayload = await firstResponse.text();
    const firstPage = JSON.parse(firstPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(firstResponse.status).toBe(200);
    expect(firstPage.runs.map((run) => run.id)).toEqual([newest.runId, middle.runId]);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(firstPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(firstPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(firstPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(firstPayload).not.toContain(rawOpenAiKey);
    expect(firstPayload).not.toContain('.env');
    expect(firstPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(firstPayload).not.toContain(tempRoot);

    const secondResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=2&cursor=${encodeURIComponent(firstPage.nextCursor ?? '')}`
    );
    const secondPayload = await secondResponse.text();
    const secondPage = JSON.parse(secondPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(secondResponse.status).toBe(200);
    expect(secondPage.runs.map((run) => run.id)).toEqual([oldest.runId]);
    expect(secondPage.nextCursor).toBeUndefined();
    expect(secondPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(secondPayload).not.toContain(rawOpenAiKey);
    expect(secondPayload).not.toContain('.env');
    expect(secondPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(secondPayload).not.toContain(tempRoot);

    const invalidOpenAiKey = `sk-${'x'.repeat(24)}`;
    const invalidCursor = encodeURIComponent(
      `/private/tmp/codebase-docs-ai/${invalidOpenAiKey}/.env/SHOULD_NOT_APPEAR`
    );
    const invalidResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?cursor=${invalidCursor}`
    );
    const invalidPayload = await invalidResponse.text();

    expect(invalidResponse.status).toBe(400);
    expect(invalidPayload).toContain('RUN_LIST_CURSOR_INVALID');
    expect(invalidPayload).not.toContain(invalidOpenAiKey);
    expect(invalidPayload).not.toContain('.env');
    expect(invalidPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidPayload).not.toContain('/private/tmp');
  });

  it('validates and applies run list sort query parameters with safe cursor paging', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'a'.repeat(24)}`;
    const oldest = await service.createRun({
      name: `HTTP Oldest Asc Cursor ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const newest = await service.createRun({
      name: `HTTP Newest Asc Cursor ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const middle = await service.createRun({
      name: `HTTP Middle Asc Cursor ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
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

    const firstResponse = await fetch(`${apiBaseUrl}/v1/documentation-runs?limit=2&sort=updatedAt:asc`);
    const firstPayload = await firstResponse.text();
    const firstPage = JSON.parse(firstPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(firstResponse.status).toBe(200);
    expect(firstPage.runs.map((run) => run.id)).toEqual([oldest.runId, middle.runId]);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(firstPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(firstPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(firstPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(firstPayload).not.toContain(rawOpenAiKey);
    expect(firstPayload).not.toContain('.env');
    expect(firstPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(firstPayload).not.toContain(tempRoot);

    const secondResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=2&sort=updatedAt:asc&cursor=${encodeURIComponent(firstPage.nextCursor ?? '')}`
    );
    const secondPayload = await secondResponse.text();
    const secondPage = JSON.parse(secondPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(secondResponse.status).toBe(200);
    expect(secondPage.runs.map((run) => run.id)).toEqual([newest.runId]);
    expect(secondPage.nextCursor).toBeUndefined();
    expect(secondPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(secondPayload).not.toContain(rawOpenAiKey);
    expect(secondPayload).not.toContain('.env');
    expect(secondPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(secondPayload).not.toContain(tempRoot);

    const invalidOpenAiKey = `sk-${'b'.repeat(24)}`;
    const invalidSort = encodeURIComponent(
      `/private/tmp/codebase-docs-ai/${invalidOpenAiKey}/.env/SHOULD_NOT_APPEAR`
    );
    const invalidResponse = await fetch(`${apiBaseUrl}/v1/documentation-runs?sort=${invalidSort}`);
    const invalidPayload = await invalidResponse.text();

    expect(invalidResponse.status).toBe(400);
    expect(invalidPayload).toContain('RUN_LIST_SORT_INVALID');
    expect(invalidPayload).not.toContain(invalidOpenAiKey);
    expect(invalidPayload).not.toContain('.env');
    expect(invalidPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidPayload).not.toContain('/private/tmp');
  });

  it('applies run list created-at sort query parameters with safe cursor paging', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'c'.repeat(24)}`;
    const oldestCreated = await service.createRun({
      name: `HTTP Oldest Created Sort ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const newestCreated = await service.createRun({
      name: `HTTP Newest Created Sort ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const middleCreated = await service.createRun({
      name: `HTTP Middle Created Sort ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    await setRunCreatedAt(oldestCreated.runId, '2026-05-30T00:00:00.000Z');
    await setRunCreatedAt(middleCreated.runId, '2026-05-30T00:01:00.000Z');
    await setRunCreatedAt(newestCreated.runId, '2026-05-30T00:02:00.000Z');
    await setRunUpdatedAt(oldestCreated.runId, '2026-05-30T00:02:00.000Z');
    await setRunUpdatedAt(middleCreated.runId, '2026-05-30T00:01:00.000Z');
    await setRunUpdatedAt(newestCreated.runId, '2026-05-30T00:00:00.000Z');

    const firstResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=2&sort=createdAt:asc`
    );
    const firstPayload = await firstResponse.text();
    const firstPage = JSON.parse(firstPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(firstResponse.status).toBe(200);
    expect(firstPage.runs.map((run) => run.id)).toEqual([
      oldestCreated.runId,
      middleCreated.runId
    ]);
    expect(firstPage.nextCursor).toBeTruthy();
    expect(firstPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(firstPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(firstPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(firstPayload).not.toContain(rawOpenAiKey);
    expect(firstPayload).not.toContain('.env');
    expect(firstPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(firstPayload).not.toContain(tempRoot);

    const secondResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=2&sort=createdAt:asc&cursor=${encodeURIComponent(firstPage.nextCursor ?? '')}`
    );
    const secondPayload = await secondResponse.text();
    const secondPage = JSON.parse(secondPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(secondResponse.status).toBe(200);
    expect(secondPage.runs.map((run) => run.id)).toEqual([newestCreated.runId]);
    expect(secondPage.nextCursor).toBeUndefined();
    expect(secondPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(secondPayload).not.toContain(rawOpenAiKey);
    expect(secondPayload).not.toContain('.env');
    expect(secondPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(secondPayload).not.toContain(tempRoot);
  });

  it('validates and applies run list updated-at range query parameters', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'y'.repeat(24)}`;
    const oldest = await service.createRun({
      name: `HTTP Oldest Updated Range ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const newest = await service.createRun({
      name: `HTTP Newest Updated Range ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    const middle = await service.createRun({
      name: `HTTP Middle Updated Range ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
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

    const filteredResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?updatedAfter=${encodeURIComponent('2026-05-30T00:00:30.000Z')}&updatedBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}`
    );
    const filteredPayload = await filteredResponse.text();
    const filtered = JSON.parse(filteredPayload) as {
      runs: Array<{ id: string }>;
    };

    expect(filteredResponse.status).toBe(200);
    expect(filtered.runs.map((run) => run.id)).toEqual([middle.runId]);
    expect(filteredPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(filteredPayload).not.toContain(rawOpenAiKey);
    expect(filteredPayload).not.toContain('.env');
    expect(filteredPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(filteredPayload).not.toContain(tempRoot);

    const invalidOpenAiKey = `sk-${'z'.repeat(24)}`;
    const invalidTimestamp = encodeURIComponent(
      `/private/tmp/codebase-docs-ai/${invalidOpenAiKey}/.env/SHOULD_NOT_APPEAR`
    );
    const invalidAfterResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?updatedAfter=${invalidTimestamp}`
    );
    const invalidAfterPayload = await invalidAfterResponse.text();
    const invalidBeforeResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?updatedBefore=${invalidTimestamp}`
    );
    const invalidBeforePayload = await invalidBeforeResponse.text();

    expect(invalidAfterResponse.status).toBe(400);
    expect(invalidAfterPayload).toContain('RUN_LIST_UPDATED_AFTER_INVALID');
    expect(invalidAfterPayload).not.toContain(invalidOpenAiKey);
    expect(invalidAfterPayload).not.toContain('.env');
    expect(invalidAfterPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidAfterPayload).not.toContain('/private/tmp');
    expect(invalidBeforeResponse.status).toBe(400);
    expect(invalidBeforePayload).toContain('RUN_LIST_UPDATED_BEFORE_INVALID');
    expect(invalidBeforePayload).not.toContain(invalidOpenAiKey);
    expect(invalidBeforePayload).not.toContain('.env');
    expect(invalidBeforePayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidBeforePayload).not.toContain('/private/tmp');
  });

  it('validates and applies run list created-at range query parameters with other list filters', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'u'.repeat(24)}`;
    const older = await createServiceRun(
      service,
      `HTTP Older Backend Created Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'backend', outputFormats: ['json'] }
    );
    const newer = await createServiceRun(
      service,
      `HTTP Backend Created Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'backend', outputFormats: ['json'] }
    );
    await createServiceRun(
      service,
      `HTTP Frontend Created Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'frontend', outputFormats: ['json'] }
    );
    await createServiceRun(
      service,
      `HTTP Markdown Backend Created Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'backend' }
    );
    await service.createRun({
      name: `HTTP Zero Source Created Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    await setRunCreatedAt(older.runId, '2026-05-30T00:00:00.000Z');
    await setRunCreatedAt(newer.runId, '2026-05-30T00:01:00.000Z');
    await setRunUpdatedAt(older.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(newer.runId, '2026-05-30T00:01:00.000Z');

    const filteredResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=1&status=completed&role=backend&name=${encodeURIComponent('backend created search')}&format=json&minSources=1&maxSources=1&sort=updatedAt:asc&createdAfter=${encodeURIComponent('2026-05-29T23:59:59.000Z')}&createdBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}&updatedAfter=${encodeURIComponent('2026-05-29T23:59:59.000Z')}&updatedBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}`
    );
    const filteredPayload = await filteredResponse.text();
    const filtered = JSON.parse(filteredPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(filteredResponse.status).toBe(200);
    expect(filtered.runs.map((run) => run.id)).toEqual([older.runId]);
    expect(filtered.nextCursor).toBeTruthy();
    expect(filteredPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(filteredPayload).not.toContain(rawOpenAiKey);
    expect(filteredPayload).not.toContain('.env');
    expect(filteredPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(filteredPayload).not.toContain(tempRoot);

    const secondResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=1&status=completed&role=backend&name=${encodeURIComponent('backend created search')}&format=json&minSources=1&maxSources=1&sort=updatedAt:asc&createdAfter=${encodeURIComponent('2026-05-29T23:59:59.000Z')}&createdBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}&updatedAfter=${encodeURIComponent('2026-05-29T23:59:59.000Z')}&updatedBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}&cursor=${encodeURIComponent(filtered.nextCursor ?? '')}`
    );
    const secondPayload = await secondResponse.text();
    const second = JSON.parse(secondPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(secondResponse.status).toBe(200);
    expect(second.runs.map((run) => run.id)).toEqual([newer.runId]);
    expect(second.nextCursor).toBeUndefined();
    expect(secondPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(secondPayload).not.toContain(rawOpenAiKey);
    expect(secondPayload).not.toContain('.env');
    expect(secondPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(secondPayload).not.toContain(tempRoot);

    const invalidOpenAiKey = `sk-${'v'.repeat(24)}`;
    const invalidTimestamp = encodeURIComponent(
      `/private/tmp/codebase-docs-ai/${invalidOpenAiKey}/.env/SHOULD_NOT_APPEAR`
    );
    const invalidAfterResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?createdAfter=${invalidTimestamp}`
    );
    const invalidAfterPayload = await invalidAfterResponse.text();
    const invalidBeforeResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?createdBefore=${invalidTimestamp}`
    );
    const invalidBeforePayload = await invalidBeforeResponse.text();

    expect(invalidAfterResponse.status).toBe(400);
    expect(invalidAfterPayload).toContain('RUN_LIST_CREATED_AFTER_INVALID');
    expect(invalidAfterPayload).not.toContain(invalidOpenAiKey);
    expect(invalidAfterPayload).not.toContain('.env');
    expect(invalidAfterPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidAfterPayload).not.toContain('/private/tmp');
    expect(invalidBeforeResponse.status).toBe(400);
    expect(invalidBeforePayload).toContain('RUN_LIST_CREATED_BEFORE_INVALID');
    expect(invalidBeforePayload).not.toContain(invalidOpenAiKey);
    expect(invalidBeforePayload).not.toContain('.env');
    expect(invalidBeforePayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidBeforePayload).not.toContain('/private/tmp');
  });

  it('validates and applies the run list name query parameter with other list filters', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'n'.repeat(24)}`;
    const secretSourceName = `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const older = await createServiceRun(
      service,
      `HTTP Older Backend Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName,
      { role: 'backend' }
    );
    const newer = await createServiceRun(
      service,
      `HTTP Backend Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName,
      { role: 'backend' }
    );
    await createServiceRun(
      service,
      `HTTP Frontend Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      secretSourceName,
      { role: 'frontend' }
    );
    await setRunUpdatedAt(older.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(newer.runId, '2026-05-30T00:01:00.000Z');

    const filteredResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=1&status=completed&role=backend&name=${encodeURIComponent('backend search')}&updatedAfter=${encodeURIComponent('2026-05-29T23:59:59.000Z')}&updatedBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}`
    );
    const filteredPayload = await filteredResponse.text();
    const filtered = JSON.parse(filteredPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(filteredResponse.status).toBe(200);
    expect(filtered.runs.map((run) => run.id)).toEqual([newer.runId]);
    expect(filtered.nextCursor).toBeTruthy();
    expect(filteredPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(filteredPayload).not.toContain(rawOpenAiKey);
    expect(filteredPayload).not.toContain('.env');
    expect(filteredPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(filteredPayload).not.toContain(tempRoot);

    const secondResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=1&status=completed&role=backend&name=${encodeURIComponent('backend search')}&updatedAfter=${encodeURIComponent('2026-05-29T23:59:59.000Z')}&updatedBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}&cursor=${encodeURIComponent(filtered.nextCursor ?? '')}`
    );
    const secondPayload = await secondResponse.text();
    const second = JSON.parse(secondPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(secondResponse.status).toBe(200);
    expect(second.runs.map((run) => run.id)).toEqual([older.runId]);
    expect(second.nextCursor).toBeUndefined();
    expect(secondPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(secondPayload).not.toContain(rawOpenAiKey);
    expect(secondPayload).not.toContain('.env');
    expect(secondPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(secondPayload).not.toContain(tempRoot);

    const invalidOpenAiKey = `sk-${'o'.repeat(24)}`;
    const invalidName = encodeURIComponent(
      `/private/tmp/codebase-docs-ai/${invalidOpenAiKey}/.env/SHOULD_NOT_APPEAR`.repeat(5)
    );
    const invalidResponse = await fetch(`${apiBaseUrl}/v1/documentation-runs?name=${invalidName}`);
    const invalidPayload = await invalidResponse.text();

    expect(invalidResponse.status).toBe(400);
    expect(invalidPayload).toContain('RUN_LIST_NAME_INVALID');
    expect(invalidPayload).not.toContain(invalidOpenAiKey);
    expect(invalidPayload).not.toContain('.env');
    expect(invalidPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidPayload).not.toContain('/private/tmp');
  });

  it('validates and applies the run list format query parameter with other list filters', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'p'.repeat(24)}`;
    const older = await createServiceRun(
      service,
      `HTTP Older Backend Format Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'backend', outputFormats: ['json'] }
    );
    const newer = await createServiceRun(
      service,
      `HTTP Backend Format Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'backend', outputFormats: ['json'] }
    );
    await createServiceRun(
      service,
      `HTTP Markdown Backend Format Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'backend' }
    );
    await createServiceRun(
      service,
      `HTTP Frontend Format Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'frontend', outputFormats: ['json'] }
    );
    await setRunUpdatedAt(older.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(newer.runId, '2026-05-30T00:01:00.000Z');

    const filteredResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=1&status=completed&role=backend&name=${encodeURIComponent('backend format search')}&format=json&updatedAfter=${encodeURIComponent('2026-05-29T23:59:59.000Z')}&updatedBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}`
    );
    const filteredPayload = await filteredResponse.text();
    const filtered = JSON.parse(filteredPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(filteredResponse.status).toBe(200);
    expect(filtered.runs.map((run) => run.id)).toEqual([newer.runId]);
    expect(filtered.nextCursor).toBeTruthy();
    expect(filteredPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(filteredPayload).not.toContain(rawOpenAiKey);
    expect(filteredPayload).not.toContain('.env');
    expect(filteredPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(filteredPayload).not.toContain(tempRoot);

    const secondResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=1&status=completed&role=backend&name=${encodeURIComponent('backend format search')}&format=json&updatedAfter=${encodeURIComponent('2026-05-29T23:59:59.000Z')}&updatedBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}&cursor=${encodeURIComponent(filtered.nextCursor ?? '')}`
    );
    const secondPayload = await secondResponse.text();
    const second = JSON.parse(secondPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(secondResponse.status).toBe(200);
    expect(second.runs.map((run) => run.id)).toEqual([older.runId]);
    expect(second.nextCursor).toBeUndefined();
    expect(secondPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(secondPayload).not.toContain(rawOpenAiKey);
    expect(secondPayload).not.toContain('.env');
    expect(secondPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(secondPayload).not.toContain(tempRoot);

    const invalidOpenAiKey = `sk-${'q'.repeat(24)}`;
    const invalidFormat = encodeURIComponent(
      `/private/tmp/codebase-docs-ai/${invalidOpenAiKey}/.env/SHOULD_NOT_APPEAR`
    );
    const invalidResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?format=${invalidFormat}`
    );
    const invalidPayload = await invalidResponse.text();

    expect(invalidResponse.status).toBe(400);
    expect(invalidPayload).toContain('RUN_LIST_FORMAT_INVALID');
    expect(invalidPayload).not.toContain(invalidOpenAiKey);
    expect(invalidPayload).not.toContain('.env');
    expect(invalidPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidPayload).not.toContain('/private/tmp');
  });

  it('validates and applies run list source count query parameters with other list filters', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'r'.repeat(24)}`;
    const older = await createServiceRun(
      service,
      `HTTP Older Backend Source Count Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'backend', outputFormats: ['json'] }
    );
    const newer = await createServiceRun(
      service,
      `HTTP Backend Source Count Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'backend', outputFormats: ['json'] }
    );
    await service.createRun({
      name: `HTTP Zero Source Count Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    await createServiceRun(
      service,
      `HTTP Frontend Source Count Search ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      { role: 'frontend', outputFormats: ['json'] }
    );
    await setRunUpdatedAt(older.runId, '2026-05-30T00:00:00.000Z');
    await setRunUpdatedAt(newer.runId, '2026-05-30T00:01:00.000Z');

    const filteredResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=1&status=completed&role=backend&name=${encodeURIComponent('backend source count search')}&format=json&minSources=1&maxSources=1&updatedAfter=${encodeURIComponent('2026-05-29T23:59:59.000Z')}&updatedBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}`
    );
    const filteredPayload = await filteredResponse.text();
    const filtered = JSON.parse(filteredPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(filteredResponse.status).toBe(200);
    expect(filtered.runs.map((run) => run.id)).toEqual([newer.runId]);
    expect(filtered.nextCursor).toBeTruthy();
    expect(filteredPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(filteredPayload).not.toContain(rawOpenAiKey);
    expect(filteredPayload).not.toContain('.env');
    expect(filteredPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(filteredPayload).not.toContain(tempRoot);

    const secondResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?limit=1&status=completed&role=backend&name=${encodeURIComponent('backend source count search')}&format=json&minSources=1&maxSources=1&updatedAfter=${encodeURIComponent('2026-05-29T23:59:59.000Z')}&updatedBefore=${encodeURIComponent('2026-05-30T00:01:30.000Z')}&cursor=${encodeURIComponent(filtered.nextCursor ?? '')}`
    );
    const secondPayload = await secondResponse.text();
    const second = JSON.parse(secondPayload) as {
      runs: Array<{ id: string }>;
      nextCursor?: string;
    };

    expect(secondResponse.status).toBe(200);
    expect(second.runs.map((run) => run.id)).toEqual([older.runId]);
    expect(second.nextCursor).toBeUndefined();
    expect(secondPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(secondPayload).not.toContain(rawOpenAiKey);
    expect(secondPayload).not.toContain('.env');
    expect(secondPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(secondPayload).not.toContain(tempRoot);

    const invalidOpenAiKey = `sk-${'t'.repeat(24)}`;
    const invalidSourceCount = encodeURIComponent(
      `/private/tmp/codebase-docs-ai/${invalidOpenAiKey}/.env/SHOULD_NOT_APPEAR`
    );
    const invalidResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?minSources=${invalidSourceCount}`
    );
    const invalidPayload = await invalidResponse.text();

    expect(invalidResponse.status).toBe(400);
    expect(invalidPayload).toContain('RUN_LIST_SOURCE_COUNT_INVALID');
    expect(invalidPayload).not.toContain(invalidOpenAiKey);
    expect(invalidPayload).not.toContain('.env');
    expect(invalidPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidPayload).not.toContain('/private/tmp');

    const invalidRangeResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?minSources=2&maxSources=1`
    );
    const invalidRangePayload = await invalidRangeResponse.text();

    expect(invalidRangeResponse.status).toBe(400);
    expect(invalidRangePayload).toContain('RUN_LIST_SOURCE_COUNT_INVALID');
    expect(invalidRangePayload).not.toContain(invalidOpenAiKey);
    expect(invalidRangePayload).not.toContain('.env');
    expect(invalidRangePayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidRangePayload).not.toContain('/private/tmp');
  });

  it('validates and applies the run list status query parameter', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'s'.repeat(24)}`;
    const secretSourceName = `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    await service.createRun({
      name: `HTTP Created Filter ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`,
      options: {
        outputFormats: ['json'],
        language: 'en',
        includeSourceReferences: true,
        includeWarnings: true
      }
    });
    await createServiceRun(service, 'HTTP Completed Filter Docs', secretSourceName);
    const failed = await createServiceRun(service, 'HTTP Failed Filter Docs', secretSourceName, {
      failBeforeStart: true
    });

    const filteredResponse = await fetch(`${apiBaseUrl}/v1/documentation-runs?status=failed`);
    const filteredPayload = await filteredResponse.text();
    const filtered = JSON.parse(filteredPayload) as {
      runs: Array<{ id: string; status: string; sourceCount: number; error?: { message: string } }>;
    };

    expect(filteredResponse.status).toBe(200);
    expect(filtered.runs.map((run) => run.id)).toEqual([failed.runId]);
    expect(filtered.runs[0]).toMatchObject({
      status: 'failed',
      sourceCount: 1,
      error: {
        message: 'Documentation generation failed.'
      }
    });
    expect(filteredPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(filteredPayload).not.toContain(rawOpenAiKey);
    expect(filteredPayload).not.toContain('.env');
    expect(filteredPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(filteredPayload).not.toContain(tempRoot);
    expect(filteredPayload).not.toContain('archivePath');
    expect(filteredPayload).not.toContain('tempPath');
    expect(filteredPayload).not.toContain('documentationTreePath');
    expect(filteredPayload).not.toContain('renderedPaths');

    const invalidOpenAiKey = `sk-${'t'.repeat(24)}`;
    const invalidStatus = encodeURIComponent(
      `/private/tmp/codebase-docs-ai/${invalidOpenAiKey}/.env/SHOULD_NOT_APPEAR`
    );
    const invalidResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs?status=${invalidStatus}`
    );
    const invalidPayload = await invalidResponse.text();

    expect(invalidResponse.status).toBe(400);
    expect(invalidPayload).toContain('RUN_LIST_STATUS_INVALID');
    expect(invalidPayload).not.toContain(invalidOpenAiKey);
    expect(invalidPayload).not.toContain('.env');
    expect(invalidPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidPayload).not.toContain('/private/tmp');
  });

  it('validates and applies the run list source role query parameter', async () => {
    const service = app.get(DocumentationRunsService);
    const rawOpenAiKey = `sk-${'u'.repeat(24)}`;
    const frontendName = `Frontend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    const backendName = `Backend ${rawOpenAiKey} .env SHOULD_NOT_APPEAR`;
    await createServiceRun(service, 'HTTP Frontend Role Filter Docs', frontendName, {
      role: 'frontend'
    });
    const backend = await createServiceRun(service, 'HTTP Backend Role Filter Docs', backendName, {
      role: 'backend'
    });

    const filteredResponse = await fetch(`${apiBaseUrl}/v1/documentation-runs?role=backend`);
    const filteredPayload = await filteredResponse.text();
    const filtered = JSON.parse(filteredPayload) as {
      runs: Array<{
        id: string;
        status: string;
        sourceCount: number;
        sources: Array<{ role: string }>;
        renderedFormats?: string[];
      }>;
    };

    expect(filteredResponse.status).toBe(200);
    expect(filtered.runs.map((run) => run.id)).toEqual([backend.runId]);
    expect(filtered.runs[0]).toMatchObject({
      status: 'completed',
      sourceCount: 1,
      sources: [
        {
          role: 'backend'
        }
      ],
      renderedFormats: ['single-markdown']
    });
    expect(filteredPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(filteredPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(filteredPayload).not.toContain(rawOpenAiKey);
    expect(filteredPayload).not.toContain('.env');
    expect(filteredPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(filteredPayload).not.toContain(tempRoot);
    expect(filteredPayload).not.toContain('archivePath');
    expect(filteredPayload).not.toContain('tempPath');
    expect(filteredPayload).not.toContain('documentationTreePath');
    expect(filteredPayload).not.toContain('renderedPaths');

    const invalidOpenAiKey = `sk-${'v'.repeat(24)}`;
    const invalidRole = encodeURIComponent(
      `/private/tmp/codebase-docs-ai/${invalidOpenAiKey}/.env/SHOULD_NOT_APPEAR`
    );
    const invalidResponse = await fetch(`${apiBaseUrl}/v1/documentation-runs?role=${invalidRole}`);
    const invalidPayload = await invalidResponse.text();

    expect(invalidResponse.status).toBe(400);
    expect(invalidPayload).toContain('RUN_LIST_SOURCE_ROLE_INVALID');
    expect(invalidPayload).not.toContain(invalidOpenAiKey);
    expect(invalidPayload).not.toContain('.env');
    expect(invalidPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(invalidPayload).not.toContain('/private/tmp');
  });

  it('keeps multi-source artifacts consistent across results and downloads', async () => {
    const outputFormats = ['markdown-tree', 'single-markdown', 'json'];
    const created = await fetchJson<{ runId: string; status: string }>(
      `${apiBaseUrl}/v1/documentation-runs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'HTTP Multi Source Documentation',
          options: {
            outputFormats,
            language: 'en',
            includeSourceReferences: true,
            includeWarnings: true
          }
        })
      }
    );
    expect(created.status).toBe('created');

    const formData = new FormData();
    formData.append(
      'metadata',
      JSON.stringify({
        sources: [
          {
            fileField: 'frontend',
            name: 'Frontend',
            role: 'frontend'
          },
          {
            fileField: 'backend',
            name: 'Backend',
            role: 'backend'
          }
        ]
      })
    );
    formData.append('frontend', await multiSourceArchiveBlob('frontend'), 'frontend.zip');
    formData.append('backend', await multiSourceArchiveBlob('backend'), 'backend.zip');

    const uploaded = await fetchJson<{ status: string; sources: unknown[] }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/sources`,
      {
        method: 'POST',
        body: formData
      }
    );
    expect(uploaded.status).toBe('ready');
    expect(uploaded.sources).toHaveLength(2);

    const started = await fetchJson<{ status: string }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/start`,
      {
        method: 'POST'
      }
    );
    expect(started.status).toBe('completed');

    const completedRun = await fetchJson<{ renderedFormats: string[] }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}`
    );
    expect(completedRun.renderedFormats).toEqual(outputFormats);

    const result = await fetchJson<{
      renderedFormats: string[];
      documentation: { pages: Array<{ markdown: string }> };
    }>(`${apiBaseUrl}/v1/documentation-runs/${created.runId}/result`);
    expect(result.renderedFormats).toEqual(outputFormats);

    const resultPayload = JSON.stringify(result.documentation);
    expect(resultPayload).toContain('Frontend');
    expect(resultPayload).toContain('frontend');
    expect(resultPayload).toContain('Backend');
    expect(resultPayload).toContain('backend');
    expect(resultPayload).toContain('/api/users');
    expect(resultPayload).toContain('matched');
    expect(resultPayload).not.toContain('No source input was marked as frontend');
    expect(resultPayload).not.toContain('No source input was marked as backend');

    const singleMarkdownResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=single-markdown`
    );
    const singleMarkdown = await singleMarkdownResponse.text();
    expect(singleMarkdownResponse.status).toBe(200);
    expect(singleMarkdownResponse.headers.get('content-type')).toContain('text/markdown');
    expectConsistentMultiSourceArtifact(singleMarkdown);

    const jsonResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=json`
    );
    const json = await jsonResponse.text();
    expect(jsonResponse.status).toBe(200);
    expect(jsonResponse.headers.get('content-type')).toContain('application/json');
    expect(JSON.parse(json)).toMatchObject({
      title: 'HTTP Multi Source Documentation'
    });
    expectConsistentMultiSourceArtifact(json);

    const markdownTreeResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=markdown-tree`
    );
    const zip = new AdmZip(Buffer.from(await markdownTreeResponse.arrayBuffer()));
    const zipContent = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.getData().toString('utf8'))
      .join('\n');
    expect(markdownTreeResponse.status).toBe(200);
    expect(markdownTreeResponse.headers.get('content-type')).toContain('application/zip');
    expectConsistentMultiSourceArtifact(zipContent);
  });

  it('returns safe public errors after expired run cleanup removes artifacts', async () => {
    const created = await createCompletedHttpRun('HTTP Expired Storage Documentation', [
      'single-markdown',
      'json'
    ]);
    await setRunUpdatedAt(created.runId, '2026-05-01T00:00:00.000Z');

    const cleanup = await app
      .get(DocumentationRunsService)
      .cleanupExpiredRuns(new Date('2026-05-30T00:00:00.000Z'));
    expect(cleanup.deletedRunIds).toEqual([created.runId]);

    for (const url of [
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}`,
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/result`,
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=single-markdown`
    ]) {
      const response = await fetch(url);
      const payload = await response.text();
      expect(response.status).toBe(404);
      expect(payload).toContain('DOCUMENTATION_RUN_NOT_FOUND');
      expect(payload).not.toContain(tempRoot);
      expect(payload).not.toContain('# 01. Overview');
    }

    const deleteResponse = await fetch(`${apiBaseUrl}/v1/documentation-runs/${created.runId}`, {
      method: 'DELETE'
    });
    const deletePayload = await deleteResponse.text();
    expect(deleteResponse.status).toBe(404);
    expect(deletePayload).toContain('DOCUMENTATION_RUN_NOT_FOUND');
    expect(deletePayload).not.toContain(tempRoot);
    expect(deletePayload).not.toContain('# 01. Overview');
  });

  it('returns safe public errors when persisted result artifacts are missing', async () => {
    const rawOpenAiKey = `sk-${'y'.repeat(24)}`;
    const created = await createCompletedHttpRun('HTTP Missing Artifact Documentation', [
      'single-markdown'
    ]);
    const manifestPath = path.join(tempRoot, created.runId, 'run.json');
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

    const resultResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/result`
    );
    const resultPayload = await resultResponse.text();
    expect(resultResponse.status).toBe(400);
    expect(resultPayload).toContain('DOCUMENTATION_RESULT_ARTIFACT_MISSING');
    expectSafePublicArtifactError(resultPayload, rawOpenAiKey);

    const downloadResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=single-markdown`
    );
    const downloadPayload = await downloadResponse.text();
    expect(downloadResponse.status).toBe(400);
    expect(downloadPayload).toContain('DOCUMENTATION_DOWNLOAD_ARTIFACT_MISSING');
    expectSafePublicArtifactError(downloadPayload, rawOpenAiKey);
  });

  it('sanitizes uploaded source content in results and downloads', async () => {
    const rawOpenAiKey = `sk-${'c'.repeat(24)}`;
    const created = await fetchJson<{ runId: string; status: string }>(
      `${apiBaseUrl}/v1/documentation-runs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'HTTP Sanitized Documentation',
          options: {
            outputFormats: ['markdown-tree', 'single-markdown', 'json'],
            language: 'en',
            includeSourceReferences: true,
            includeWarnings: true
          }
        })
      }
    );
    expect(created.status).toBe('created');

    const formData = new FormData();
    formData.append(
      'metadata',
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
    formData.append('frontend', await sanitizationArchiveBlob(rawOpenAiKey), 'frontend.zip');

    const uploaded = await fetchJson<{ status: string }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/sources`,
      {
        method: 'POST',
        body: formData
      }
    );
    expect(uploaded.status).toBe('ready');

    const started = await fetchJson<{ status: string }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/start`,
      {
        method: 'POST'
      }
    );
    expect(started.status).toBe('completed');

    const result = await fetchJson<{ documentation: unknown }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/result`
    );
    const resultPayload = JSON.stringify(result);
    expect(resultPayload).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(resultPayload).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(resultPayload).toContain('[REDACTED_DENIED_FILE]');
    expect(resultPayload).toContain('[REDACTED_DENIED_VALUE]');
    expect(resultPayload).not.toContain(rawOpenAiKey);
    expect(resultPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(resultPayload).not.toContain('.env');

    const downloadResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=single-markdown`
    );
    const markdown = await downloadResponse.text();
    expect(downloadResponse.status).toBe(200);
    expect(markdown).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(markdown).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(markdown).toContain('[REDACTED_DENIED_FILE]');
    expect(markdown).toContain('[REDACTED_DENIED_VALUE]');
    expect(markdown).not.toContain(rawOpenAiKey);
    expect(markdown).not.toContain('SHOULD_NOT_APPEAR');
    expect(markdown).not.toContain('.env');

    const jsonDownloadResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=json`
    );
    const json = await jsonDownloadResponse.text();
    expect(jsonDownloadResponse.status).toBe(200);
    expect(jsonDownloadResponse.headers.get('content-type')).toContain('application/json');
    expect(JSON.parse(json)).toMatchObject({
      title: 'HTTP Sanitized Documentation'
    });
    expect(json).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(json).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(json).toContain('[REDACTED_DENIED_FILE]');
    expect(json).toContain('[REDACTED_DENIED_VALUE]');
    expect(json).not.toContain(rawOpenAiKey);
    expect(json).not.toContain('SHOULD_NOT_APPEAR');
    expect(json).not.toContain('.env');

    const markdownTreeDownloadResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=markdown-tree`
    );
    const zip = new AdmZip(Buffer.from(await markdownTreeDownloadResponse.arrayBuffer()));
    const zipContent = zip
      .getEntries()
      .filter((entry) => !entry.isDirectory)
      .map((entry) => entry.getData().toString('utf8'))
      .join('\n');
    expect(markdownTreeDownloadResponse.status).toBe(200);
    expect(markdownTreeDownloadResponse.headers.get('content-type')).toContain('application/zip');
    expect(zipContent).toContain('[REDACTED_OPENAI_API_KEY]');
    expect(zipContent).toContain('prefix_[REDACTED_OPENAI_API_KEY]');
    expect(zipContent).toContain('[REDACTED_DENIED_FILE]');
    expect(zipContent).toContain('[REDACTED_DENIED_VALUE]');
    expect(zipContent).not.toContain(rawOpenAiKey);
    expect(zipContent).not.toContain('SHOULD_NOT_APPEAR');
    expect(zipContent).not.toContain('.env');
  });
});

async function archiveBlob(): Promise<Blob> {
  const archive = new AdmZip();
  archive.addFile(
    'package.json',
    Buffer.from(
      JSON.stringify({
        dependencies: {
          next: 'latest',
          react: 'latest'
        },
        scripts: {
          dev: 'next dev',
          test: 'vitest run'
        }
      })
    )
  );
  archive.addFile('app/page.tsx', Buffer.from('export default function Page() { return null; }\n'));
  return new Blob([await readFile(await writeArchive(archive))], {
    type: 'application/zip'
  });
}

async function createCompletedHttpRun(
  name: string,
  outputFormats: string[]
): Promise<{ runId: string }> {
  const created = await fetchJson<{ runId: string; status: string }>(
    `${apiBaseUrl}/v1/documentation-runs`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        options: {
          outputFormats,
          language: 'en',
          includeSourceReferences: true,
          includeWarnings: true
        }
      })
    }
  );
  const formData = new FormData();
  formData.append(
    'metadata',
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
  formData.append('frontend', await archiveBlob(), 'frontend.zip');

  await fetchJson(`${apiBaseUrl}/v1/documentation-runs/${created.runId}/sources`, {
    method: 'POST',
    body: formData
  });
  await fetchJson(`${apiBaseUrl}/v1/documentation-runs/${created.runId}/start`, {
    method: 'POST'
  });

  return {
    runId: created.runId
  };
}

async function createServiceRun(
  service: DocumentationRunsService,
  name: string,
  sourceName: string,
  options: {
    failBeforeStart?: boolean;
    role?: string;
    outputFormats?: Array<'markdown-tree' | 'single-markdown' | 'json'>;
  } = {}
): Promise<{ runId: string }> {
  const created = await service.createRun({
    name,
    options: {
      outputFormats: options.outputFormats ?? ['single-markdown'],
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
        buffer: serviceArchiveBuffer()
      }
    ],
    JSON.stringify({
      sources: [
        {
          fileField: 'frontend',
          name: sourceName,
          role: options.role ?? 'frontend'
        }
      ]
    })
  );

  if (options.failBeforeStart) {
    await rm(path.join(tempRoot, created.runId, 'uploads'), {
      recursive: true,
      force: true
    });
    await expect(service.startRun(created.runId)).rejects.toThrow();
  } else {
    await service.startRun(created.runId);
  }

  return {
    runId: created.runId
  };
}

function serviceArchiveBuffer(): Buffer {
  const archive = new AdmZip();
  archive.addFile(
    'package.json',
    Buffer.from(
      JSON.stringify({
        dependencies: {
          next: 'latest',
          react: 'latest'
        },
        scripts: {
          dev: 'next dev',
          test: 'vitest run'
        }
      })
    )
  );
  archive.addFile('app/page.tsx', Buffer.from('export default function Page() { return null; }\n'));
  return archive.toBuffer();
}

async function sanitizationArchiveBlob(rawOpenAiKey: string): Promise<Blob> {
  const embeddedOpenAiKey = `prefix_${rawOpenAiKey}`;
  const archive = new AdmZip();
  archive.addFile(
    'package.json',
    Buffer.from(
      JSON.stringify({
        scripts: {
          [`dev-${embeddedOpenAiKey}`]: `vite --token ${embeddedOpenAiKey}`
        },
        dependencies: {
          react: 'latest',
          [`react-${embeddedOpenAiKey}`]: 'latest'
        }
      })
    )
  );
  archive.addFile(
    'api.ts',
    Buffer.from(
      `fetch("https://api.example.com/v1/${embeddedOpenAiKey}/.env/SHOULD_NOT_APPEAR", { method: "POST" });\n`
    )
  );
  archive.addFile('.env', Buffer.from('IGNORED_ENV=process.env.SHOULD_NOT_APPEAR\n'));

  return new Blob([await readFile(await writeArchive(archive, 'sanitized-frontend.zip'))], {
    type: 'application/zip'
  });
}

async function multiSourceArchiveBlob(kind: 'frontend' | 'backend'): Promise<Blob> {
  const archive = new AdmZip();

  if (kind === 'frontend') {
    archive.addFile(
      'package.json',
      Buffer.from(
        JSON.stringify({
          dependencies: {
            react: 'latest',
            vite: 'latest'
          },
          scripts: {
            dev: 'vite',
            test: 'vitest run'
          }
        })
      )
    );
    archive.addFile('src/api.ts', Buffer.from('fetch("/api/users", { method: "GET" });\n'));
  } else {
    archive.addFile(
      'package.json',
      Buffer.from(
        JSON.stringify({
          dependencies: {
            '@nestjs/core': 'latest'
          },
          scripts: {
            start: 'nest start',
            test: 'vitest run'
          }
        })
      )
    );
    archive.addFile(
      'src/users.controller.ts',
      Buffer.from(
        [
          "import { Controller, Get } from '@nestjs/common';",
          '',
          "@Controller('api/users')",
          'export class UsersController {',
          '  @Get()',
          '  listUsers() {',
          '    return [];',
          '  }',
          '}',
          ''
        ].join('\n')
      )
    );
  }

  return new Blob([await readFile(await writeArchive(archive, `multi-${kind}.zip`))], {
    type: 'application/zip'
  });
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

function expectSafePublicArtifactError(payload: string, rawOpenAiKey: string): void {
  expect(payload).not.toContain(rawOpenAiKey);
  expect(payload).not.toContain('SHOULD_NOT_APPEAR');
  expect(payload).not.toContain('.env');
  expect(payload).not.toContain(tempRoot);
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

async function writeArchive(archive: AdmZip, fileName = 'frontend.zip'): Promise<string> {
  const archivePath = path.join(tempRoot, fileName);
  await new Promise<void>((resolve, reject) => {
    archive.writeZip(archivePath, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
  return archivePath;
}

async function fetchJson<TValue>(url: string, init?: RequestInit): Promise<TValue> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<TValue>;
}
