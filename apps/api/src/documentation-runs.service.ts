import { randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit
} from '@nestjs/common';
import { createOpenAiCompatibleProviderFromEnv } from '@codebase-docs-ai/ai-orchestrator';
import { DocumentationEngine } from '@codebase-docs-ai/core';
import { renderZip } from '@codebase-docs-ai/renderers';
import {
  createDocumentationRunSchema,
  documentationOutputFormatSchema,
  sourceInputMetadataSchema
} from '@codebase-docs-ai/shared';
import type {
  DocumentationOutputFormat,
  DocumentationRun,
  DocumentationRunError,
  DocumentationRunProgress,
  DocumentationRunStatus,
  DocumentationTree,
  RenderedDocumentation,
  SourceInputMetadata
} from '@codebase-docs-ai/shared';
import { loadArchiveSource } from '@codebase-docs-ai/source-loader';
import { z } from 'zod';

interface UploadedSourceFile {
  fieldname: string;
  originalname: string;
  buffer: Buffer;
}

interface StoredSource {
  metadata: SourceInputMetadata;
  archivePath: string;
  originalName: string;
}

interface StoredRun {
  run: DocumentationRun;
  sources: StoredSource[];
  tempPath: string;
  documentationTreePath?: string;
  renderedPaths?: Partial<Record<DocumentationOutputFormat, string>>;
}

interface DownloadResult {
  fileName: string;
  mediaType: string;
  content: string | Buffer;
}

interface CleanupExpiredRunsResult {
  deletedRunIds: string[];
}

const uploadSourcesMetadataSchema = z.object({
  sources: z.array(
    sourceInputMetadataSchema.extend({
      fileField: z.string().min(1)
    })
  )
});

const generationSteps = [
  'running',
  'extracting_sources',
  'analyzing_sources',
  'building_system_map',
  'generating_documentation',
  'rendering_output',
  'completed'
] as const;

const sourceUploadAllowedStatuses: DocumentationRunStatus[] = ['created', 'ready'];
const startAllowedStatuses: DocumentationRunStatus[] = ['ready'];
const defaultRunRetentionMs = 24 * 60 * 60 * 1000;
const defaultRunCleanupIntervalMs = 60 * 60 * 1000;

@Injectable()
export class DocumentationRunsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DocumentationRunsService.name);
  private readonly engine = createDocumentationEngine();
  private readonly tempRoot = path.resolve(process.env.DOCS_AI_TMP_DIR ?? '.tmp/codebase-docs-ai');
  private readonly runRetentionMs = parseDurationMs(
    process.env.DOCS_AI_RUN_RETENTION_MS,
    defaultRunRetentionMs
  );
  private readonly runCleanupIntervalMs = parseDurationMs(
    process.env.DOCS_AI_RUN_CLEANUP_INTERVAL_MS,
    defaultRunCleanupIntervalMs
  );
  private cleanupInterval: ReturnType<typeof setInterval> | undefined;

  async onModuleInit(): Promise<void> {
    if (this.runCleanupIntervalMs <= 0) {
      return;
    }

    await this.runCleanupCycle();
    this.cleanupInterval = setInterval(() => {
      void this.runCleanupCycle();
    }, this.runCleanupIntervalMs);
    this.cleanupInterval.unref?.();
  }

  onModuleDestroy(): void {
    if (!this.cleanupInterval) {
      return;
    }

    clearInterval(this.cleanupInterval);
    this.cleanupInterval = undefined;
  }

  async createRun(body: unknown): Promise<{ runId: string; status: DocumentationRunStatus }> {
    const parsed = createDocumentationRunSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_DOCUMENTATION_RUN',
        message: 'Documentation run request is invalid.',
        details: parsed.error.flatten()
      });
    }

    const runId = `run_${randomUUID()}`;
    const now = new Date().toISOString();
    const run: DocumentationRun = {
      id: runId,
      name: parsed.data.name,
      status: 'created',
      sources: [],
      options: parsed.data.options,
      createdAt: now,
      updatedAt: now
    };
    const storedRun: StoredRun = {
      run,
      sources: [],
      tempPath: this.runPath(runId)
    };

    await this.writeRun(storedRun);

    return {
      runId,
      status: run.status
    };
  }

  async uploadSources(
    runId: string,
    files: UploadedSourceFile[],
    metadataJson: string
  ): Promise<{ runId: string; status: DocumentationRunStatus; sources: SourceInputMetadata[] }> {
    const storedRun = await this.requireRun(runId);
    assertRunStatus(
      storedRun,
      sourceUploadAllowedStatuses,
      'RUN_SOURCE_UPLOAD_NOT_ALLOWED',
      'Source uploads are only allowed before a documentation run starts.'
    );
    const parsedMetadata = uploadSourcesMetadataSchema.safeParse(parseJson(metadataJson));
    if (!parsedMetadata.success) {
      throw new BadRequestException({
        code: 'INVALID_SOURCE_METADATA',
        message: 'Source upload metadata is invalid.',
        details: parsedMetadata.error.flatten()
      });
    }

    const uploadPath = path.join(storedRun.tempPath, 'uploads');
    await this.resetSourceArtifacts(storedRun);
    await mkdir(uploadPath, {
      recursive: true
    });

    const storedSources: StoredSource[] = [];
    for (const sourceMetadata of parsedMetadata.data.sources) {
      const file = files.find((candidate) => candidate.fieldname === sourceMetadata.fileField);
      if (!file) {
        throw new BadRequestException({
          code: 'SOURCE_FILE_MISSING',
          message: `No uploaded file found for field ${sourceMetadata.fileField}.`
        });
      }

      const archivePath = path.join(uploadPath, `${randomUUID()}-${file.originalname}`);
      await writeFile(archivePath, file.buffer);
      storedSources.push({
        metadata: {
          name: sourceMetadata.name,
          role: sourceMetadata.role,
          ...(sourceMetadata.id ? { id: sourceMetadata.id } : {}),
          ...(sourceMetadata.metadata ? { metadata: sourceMetadata.metadata } : {})
        },
        archivePath,
        originalName: file.originalname
      });
    }

    storedRun.sources = storedSources;
    storedRun.run.sources = storedSources.map((source) => source.metadata);
    await this.setStatus(storedRun, 'ready', {
      currentStep: 'Sources uploaded',
      completedSteps: 0,
      totalSteps: generationSteps.length
    });

    return {
      runId,
      status: storedRun.run.status,
      sources: storedRun.run.sources
    };
  }

  async startRun(runId: string): Promise<{ runId: string; status: DocumentationRunStatus }> {
    const storedRun = await this.requireRun(runId);
    if (storedRun.sources.length === 0) {
      throw new BadRequestException({
        code: 'NO_SOURCES_UPLOADED',
        message: 'Upload at least one source archive before starting the run.'
      });
    }
    assertRunStatus(
      storedRun,
      startAllowedStatuses,
      'RUN_START_NOT_ALLOWED',
      'Documentation runs can only be started from the ready status.'
    );

    try {
      await this.setGenerationStatus(storedRun, 'running');
      await this.setGenerationStatus(storedRun, 'extracting_sources');

      const loadedSources = await Promise.all(
        storedRun.sources.map((source) =>
          loadArchiveSource({
            source: source.metadata,
            archivePath: source.archivePath,
            extractionRoot: path.join(storedRun.tempPath, 'extracted')
          })
        )
      );

      await this.setGenerationStatus(storedRun, 'analyzing_sources');
      await this.setGenerationStatus(storedRun, 'building_system_map');
      await this.setGenerationStatus(storedRun, 'generating_documentation');
      const result = await this.engine.generateDocumentation({
        title: storedRun.run.name,
        loadedSources,
        options: storedRun.run.options
      });

      await this.setGenerationStatus(storedRun, 'rendering_output');
      await this.writeResultArtifacts(storedRun, result.documentationTree, result.rendered);
      await this.setGenerationStatus(storedRun, 'completed');
    } catch (error) {
      await this.failRun(storedRun, error);
      throw error;
    }

    return {
      runId,
      status: storedRun.run.status
    };
  }

  async getRun(runId: string): Promise<DocumentationRun> {
    return (await this.requireRun(runId)).run;
  }

  async getResult(
    runId: string
  ): Promise<{
    runId: string;
    status: DocumentationRunStatus;
    renderedFormats: DocumentationOutputFormat[];
    documentation: DocumentationTree;
  }> {
    const storedRun = await this.requireRun(runId);
    if (!storedRun.documentationTreePath) {
      throw new BadRequestException({
        code: 'DOCUMENTATION_NOT_READY',
        message: 'Documentation result is not ready yet.'
      });
    }
    const documentationTree = await this.readJsonFile<DocumentationTree>(storedRun.documentationTreePath);

    return {
      runId,
      status: storedRun.run.status,
      renderedFormats: availableRenderedFormats(storedRun),
      documentation: documentationTree
    };
  }

  async getDownload(runId: string, format: string): Promise<DownloadResult> {
    const storedRun = await this.requireRun(runId);
    if (!storedRun.renderedPaths) {
      throw new BadRequestException({
        code: 'DOCUMENTATION_NOT_READY',
        message: 'Documentation download is not ready yet.'
      });
    }

    const parsedFormat = documentationOutputFormatSchema.safeParse(format);
    if (!parsedFormat.success) {
      throw new BadRequestException({
        code: 'UNSUPPORTED_OUTPUT_FORMAT',
        message: `Unsupported output format: ${format}.`
      });
    }

    const renderedPath = storedRun.renderedPaths[parsedFormat.data];
    if (!renderedPath) {
      throw new BadRequestException({
        code: 'OUTPUT_FORMAT_NOT_RENDERED',
        message: `Output format was not rendered for this run: ${format}.`
      });
    }
    const rendered = await this.readJsonFile<RenderedDocumentation>(renderedPath);

    if (parsedFormat.data === 'markdown-tree') {
      return {
        fileName: 'documentation.zip',
        mediaType: 'application/zip',
        content: renderZip(rendered)
      };
    }

    const file = rendered.files[0];
    if (!file) {
      throw new BadRequestException({
        code: 'RENDERED_FILE_MISSING',
        message: 'Rendered output did not contain a downloadable file.'
      });
    }

    return {
      fileName: file.path,
      mediaType: file.mediaType,
      content: file.content
    };
  }

  async deleteRun(runId: string): Promise<void> {
    const storedRun = await this.requireRun(runId);
    await rm(storedRun.tempPath, {
      recursive: true,
      force: true
    });
  }

  async cleanupExpiredRuns(now: Date = new Date()): Promise<CleanupExpiredRunsResult> {
    const deletedRunIds: string[] = [];
    const cutoffTime = now.getTime() - this.runRetentionMs;

    for (const entry of await this.listRunDirectoryNames()) {
      const manifestPath = this.manifestPath(entry);
      let storedRun: StoredRun;
      try {
        storedRun = await this.readJsonFile<StoredRun>(manifestPath);
      } catch {
        continue;
      }

      if (new Date(storedRun.run.updatedAt).getTime() > cutoffTime) {
        continue;
      }

      await rm(storedRun.tempPath, {
        recursive: true,
        force: true
      });
      deletedRunIds.push(storedRun.run.id);
    }

    return {
      deletedRunIds
    };
  }

  private async runCleanupCycle(): Promise<void> {
    try {
      const cleanup = await this.cleanupExpiredRuns();
      if (cleanup.deletedRunIds.length > 0) {
        this.logger.log(`Deleted ${cleanup.deletedRunIds.length} expired documentation run(s).`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown cleanup failure.';
      this.logger.warn(`Documentation run cleanup failed: ${message}`);
    }
  }

  private async requireRun(runId: string): Promise<StoredRun> {
    try {
      return await this.readJsonFile<StoredRun>(this.manifestPath(runId));
    } catch {
      throw new NotFoundException({
        code: 'DOCUMENTATION_RUN_NOT_FOUND',
        message: `Documentation run was not found: ${runId}.`
      });
    }
  }

  private async setStatus(
    storedRun: StoredRun,
    status: DocumentationRunStatus,
    progress?: DocumentationRunProgress
  ): Promise<void> {
    storedRun.run.status = status;
    storedRun.run.updatedAt = new Date().toISOString();
    if (progress) {
      storedRun.run.progress = progress;
    }
    if (status !== 'failed') {
      delete storedRun.run.error;
    }
    await this.writeRun(storedRun);
  }

  private async setGenerationStatus(
    storedRun: StoredRun,
    status: (typeof generationSteps)[number]
  ): Promise<void> {
    const completedSteps =
      status === 'completed' ? generationSteps.length : generationSteps.indexOf(status);
    await this.setStatus(storedRun, status, {
      currentStep: generationStepLabel(status),
      completedSteps,
      totalSteps: generationSteps.length
    });
  }

  private async failRun(storedRun: StoredRun, error: unknown): Promise<void> {
    storedRun.run.error = safeRunError(error);
    await this.setStatus(storedRun, 'failed', {
      currentStep: 'Failed',
      completedSteps: storedRun.run.progress?.completedSteps ?? 0,
      totalSteps: storedRun.run.progress?.totalSteps ?? generationSteps.length
    });
  }

  private async writeResultArtifacts(
    storedRun: StoredRun,
    documentationTree: DocumentationTree,
    rendered: Map<DocumentationOutputFormat, RenderedDocumentation>
  ): Promise<void> {
    const resultPath = path.join(storedRun.tempPath, 'results');
    await mkdir(resultPath, {
      recursive: true
    });

    storedRun.documentationTreePath = path.join(resultPath, 'documentation-tree.json');
    await writeJsonFile(storedRun.documentationTreePath, documentationTree);

    const renderedPaths: Partial<Record<DocumentationOutputFormat, string>> = {};
    for (const [format, renderedDocumentation] of rendered.entries()) {
      const renderedPath = path.join(resultPath, `rendered-${format}.json`);
      await writeJsonFile(renderedPath, renderedDocumentation);
      renderedPaths[format] = renderedPath;
    }
    storedRun.renderedPaths = renderedPaths;
    storedRun.run.renderedFormats = availableRenderedFormats(storedRun);
    await this.writeRun(storedRun);
  }

  private async resetSourceArtifacts(storedRun: StoredRun): Promise<void> {
    delete storedRun.documentationTreePath;
    delete storedRun.renderedPaths;
    delete storedRun.run.renderedFormats;
    await Promise.all([
      rm(path.join(storedRun.tempPath, 'uploads'), {
        recursive: true,
        force: true
      }),
      rm(path.join(storedRun.tempPath, 'extracted'), {
        recursive: true,
        force: true
      }),
      rm(path.join(storedRun.tempPath, 'results'), {
        recursive: true,
        force: true
      })
    ]);
  }

  private async writeRun(storedRun: StoredRun): Promise<void> {
    await mkdir(storedRun.tempPath, {
      recursive: true
    });
    await writeJsonFile(this.manifestPath(storedRun.run.id), storedRun);
  }

  private async readJsonFile<TValue>(filePath: string): Promise<TValue> {
    return JSON.parse(await readFile(filePath, 'utf8')) as TValue;
  }

  private manifestPath(runId: string): string {
    return path.join(this.runPath(runId), 'run.json');
  }

  private runPath(runId: string): string {
    return path.join(this.tempRoot, runId);
  }

  private async listRunDirectoryNames(): Promise<string[]> {
    try {
      const entries = await readdir(this.tempRoot, {
        withFileTypes: true
      });
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch {
      return [];
    }
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function createDocumentationEngine(): DocumentationEngine {
  const aiProvider = createOpenAiCompatibleProviderFromEnv();
  return new DocumentationEngine(aiProvider ? { aiProvider } : {});
}

function generationStepLabel(status: (typeof generationSteps)[number]): string {
  switch (status) {
    case 'running':
      return 'Starting documentation run';
    case 'extracting_sources':
      return 'Extracting source archives';
    case 'analyzing_sources':
      return 'Analyzing source repositories';
    case 'building_system_map':
      return 'Building cross-source system map';
    case 'generating_documentation':
      return 'Generating documentation tree';
    case 'rendering_output':
      return 'Rendering output artifacts';
    case 'completed':
      return 'Documentation run completed';
  }
}

function safeRunError(error: unknown): DocumentationRunError {
  if (error instanceof Error) {
    return {
      message: error.message
    };
  }

  return {
    message: 'Documentation generation failed.'
  };
}

function availableRenderedFormats(storedRun: StoredRun): DocumentationOutputFormat[] {
  const renderedFormats = storedRun.run.renderedFormats;
  if (renderedFormats) {
    return renderedFormats;
  }

  return Object.keys(storedRun.renderedPaths ?? {}) as DocumentationOutputFormat[];
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new BadRequestException({
      code: 'INVALID_JSON',
      message: 'Expected valid JSON metadata.'
    });
  }
}

function parseDurationMs(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return parsed;
}

function assertRunStatus(
  storedRun: StoredRun,
  allowedStatuses: DocumentationRunStatus[],
  code: string,
  message: string
): void {
  if (allowedStatuses.includes(storedRun.run.status)) {
    return;
  }

  throw new BadRequestException({
    code,
    message,
    details: {
      status: storedRun.run.status,
      allowedStatuses
    }
  });
}
