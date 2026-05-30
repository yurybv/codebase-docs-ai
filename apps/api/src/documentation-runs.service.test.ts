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

function sourceMetadata(): string {
  return JSON.stringify({
    sources: [
      {
        fileField: 'frontend',
        name: 'Frontend',
        role: 'frontend'
      }
    ]
  });
}

async function createCompletedRun(name: string): Promise<{ runId: string }> {
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
    sourceMetadata()
  );
  await service.startRun(created.runId);
  return {
    runId: created.runId
  };
}

async function createFailedRun(name: string): Promise<{ runId: string }> {
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
    sourceMetadata()
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
