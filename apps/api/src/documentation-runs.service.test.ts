import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DocumentationRunsService } from './documentation-runs.service.js';

let tempRoot: string;
let service: DocumentationRunsService;

beforeEach(async () => {
  tempRoot = await mkdtemp(path.join(os.tmpdir(), 'codebase-docs-ai-api-'));
  process.env.DOCS_AI_TMP_DIR = tempRoot;
  service = new DocumentationRunsService();
});

afterEach(async () => {
  await rm(tempRoot, {
    recursive: true,
    force: true
  });
  delete process.env.DOCS_AI_TMP_DIR;
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

    const result = await service.getResult(created.runId);
    expect(result.documentation.pages).toHaveLength(14);

    const restartedService = new DocumentationRunsService();
    const persistedRun = await restartedService.getRun(created.runId);
    expect(persistedRun.status).toBe('completed');

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
});
