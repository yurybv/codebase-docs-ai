import 'reflect-metadata';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from './app-bootstrap.js';
import { AppModule } from './app.module.js';

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

    const result = await fetchJson<{ renderedFormats: string[]; documentation: { pages: unknown[] } }>(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/result`
    );
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
    expect(resultPayload).not.toContain(rawOpenAiKey);
    expect(resultPayload).not.toContain('SHOULD_NOT_APPEAR');
    expect(resultPayload).not.toContain('.env');

    const downloadResponse = await fetch(
      `${apiBaseUrl}/v1/documentation-runs/${created.runId}/download?format=single-markdown`
    );
    const markdown = await downloadResponse.text();
    expect(downloadResponse.status).toBe(200);
    expect(markdown).toContain('[REDACTED_OPENAI_API_KEY]');
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
    expect(json).not.toContain(rawOpenAiKey);
    expect(json).not.toContain('SHOULD_NOT_APPEAR');
    expect(json).not.toContain('.env');
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

async function sanitizationArchiveBlob(rawOpenAiKey: string): Promise<Blob> {
  const archive = new AdmZip();
  archive.addFile(
    'package.json',
    Buffer.from(
      JSON.stringify({
        dependencies: {
          react: 'latest'
        }
      })
    )
  );
  archive.addFile(
    'api.ts',
    Buffer.from(`fetch("https://api.example.com/v1/${rawOpenAiKey}", { method: "POST" });\n`)
  );
  archive.addFile('.env', Buffer.from('IGNORED_ENV=process.env.SHOULD_NOT_APPEAR\n'));

  return new Blob([await readFile(await writeArchive(archive, 'sanitized-frontend.zip'))], {
    type: 'application/zip'
  });
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
