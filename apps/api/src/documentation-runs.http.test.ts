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
  options: { failBeforeStart?: boolean } = {}
): Promise<{ runId: string }> {
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
        buffer: serviceArchiveBuffer()
      }
    ],
    JSON.stringify({
      sources: [
        {
          fileField: 'frontend',
          name: sourceName,
          role: 'frontend'
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
