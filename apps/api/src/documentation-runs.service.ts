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
  defaultDocumentationRunListLimit,
  documentationOutputFormatSchema,
  isSupportedSourceArchiveFileName,
  maxDocumentationRunListLimit,
  sanitizePublicErrorText,
  sourceInputMetadataSchema,
  sourceRoleSchema,
  supportedSourceArchiveExtensions
} from '@codebase-docs-ai/shared';
import type {
  DocumentationRunListResponse,
  DocumentationOutputFormat,
  DocumentationRun,
  DocumentationRunError,
  DocumentationRunProgress,
  DocumentationRunSummary,
  DocumentationRunStatus,
  DocumentationTree,
  RenderedDocumentation,
  SourceInputMetadata,
  SourceRole
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

interface ListRunsOptions {
  limit?: unknown;
  status?: unknown;
  role?: unknown;
  name?: unknown;
  format?: unknown;
  minSources?: unknown;
  maxSources?: unknown;
  sort?: unknown;
  cursor?: unknown;
  createdAfter?: unknown;
  createdBefore?: unknown;
  completedAfter?: unknown;
  completedBefore?: unknown;
  updatedAfter?: unknown;
  updatedBefore?: unknown;
}

interface RunListCursor {
  updatedAt: string;
  createdAt?: string | undefined;
  id: string;
}

type RunListSort = (typeof runListSortOptions)[number];
type RunListSortField = 'updatedAt' | 'createdAt';
type RunListSortDirection = 'desc' | 'asc';

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
const runListFilterStatuses: DocumentationRunStatus[] = [
  'created',
  'uploading_sources',
  'ready',
  'running',
  'extracting_sources',
  'analyzing_sources',
  'building_system_map',
  'generating_documentation',
  'rendering_output',
  'completed',
  'failed',
  'cancelled',
  'expired'
];
const defaultRunRetentionMs = 24 * 60 * 60 * 1000;
const defaultRunCleanupIntervalMs = 60 * 60 * 1000;
const maxRunListCursorLength = 512;
const maxRunListNameLength = 200;
const runListSortOptions = ['updatedAt:desc', 'updatedAt:asc', 'createdAt:desc', 'createdAt:asc'] as const;

const runListCursorSchema = z.object({
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime().optional(),
  id: z.string().min(1)
});
const runListTimestampSchema = z.string().datetime();

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

  async listRuns(options: ListRunsOptions = {}): Promise<DocumentationRunListResponse> {
    const runs: DocumentationRunSummary[] = [];
    const limit = parseRunListLimit(options.limit);
    const status = parseRunListStatus(options.status);
    const role = parseRunListSourceRole(options.role);
    const name = parseRunListName(options.name);
    const format = parseRunListFormat(options.format);
    const sourceCountRange = parseRunListSourceCountRange(options.minSources, options.maxSources);
    const sort = parseRunListSort(options.sort);
    const cursor = parseRunListCursor(options.cursor);
    const createdAfter = parseRunListCreatedAfter(options.createdAfter);
    const createdBefore = parseRunListCreatedBefore(options.createdBefore);
    const completedAfter = parseRunListCompletedAfter(options.completedAfter);
    const completedBefore = parseRunListCompletedBefore(options.completedBefore);
    const updatedAfter = parseRunListUpdatedAfter(options.updatedAfter);
    const updatedBefore = parseRunListUpdatedBefore(options.updatedBefore);

    for (const entry of await this.listRunDirectoryNames()) {
      try {
        const storedRun = await this.readJsonFile<StoredRun>(this.manifestPath(entry));
        const createdAt = Date.parse(storedRun.run.createdAt);
        const updatedAt = Date.parse(storedRun.run.updatedAt);
        const completedAt =
          storedRun.run.completedAt === undefined ? undefined : Date.parse(storedRun.run.completedAt);
        if (status && storedRun.run.status !== status) {
          continue;
        }
        if (role && !storedRun.run.sources.some((source) => source.role === role)) {
          continue;
        }
        if (createdAfter !== undefined && createdAt < createdAfter) {
          continue;
        }
        if (createdBefore !== undefined && createdAt > createdBefore) {
          continue;
        }
        if (updatedAfter !== undefined && updatedAt < updatedAfter) {
          continue;
        }
        if (updatedBefore !== undefined && updatedAt > updatedBefore) {
          continue;
        }
        if (completedAfter !== undefined && (completedAt === undefined || completedAt < completedAfter)) {
          continue;
        }
        if (completedBefore !== undefined && (completedAt === undefined || completedAt > completedBefore)) {
          continue;
        }
        const summary = toRunSummary(storedRun.run);
        if (name && !summary.name.toLowerCase().includes(name)) {
          continue;
        }
        if (format && !runSummaryIncludesFormat(summary, format)) {
          continue;
        }
        if (
          (sourceCountRange.minSources !== undefined &&
            summary.sourceCount < sourceCountRange.minSources) ||
          (sourceCountRange.maxSources !== undefined &&
            summary.sourceCount > sourceCountRange.maxSources)
        ) {
          continue;
        }
        runs.push(summary);
      } catch {
        continue;
      }
    }

    const sortedRuns = sortRunSummaries(runs, sort);
    const pagedRuns = cursor
      ? sortedRuns.filter((run) => compareRunSummaryToCursor(run, cursor, sort) > 0)
      : sortedRuns;
    const page = pagedRuns.slice(0, limit);
    const hasMore = pagedRuns.length > page.length;

    return {
      runs: page,
      ...(hasMore && page.length > 0
        ? { nextCursor: encodeRunListCursor(page[page.length - 1]!) }
        : {})
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

    const uploadCandidates = parsedMetadata.data.sources.map((sourceMetadata) => {
      const file = files.find((candidate) => candidate.fieldname === sourceMetadata.fileField);
      if (!file) {
        throw new BadRequestException({
          code: 'SOURCE_FILE_MISSING',
          message: `No uploaded file found for field ${sourceMetadata.fileField}.`
        });
      }
      assertSupportedArchiveFile(file.originalname);
      return {
        sourceMetadata,
        file
      };
    });

    const uploadPath = path.join(storedRun.tempPath, 'uploads');
    await this.resetSourceArtifacts(storedRun);
    await mkdir(uploadPath, {
      recursive: true
    });

    const storedSources: StoredSource[] = [];
    for (const { sourceMetadata, file } of uploadCandidates) {
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
      await this.failRun(storedRun);
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

  async getResult(runId: string): Promise<{
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
    const documentationTree = await this.readArtifactJsonFile<DocumentationTree>(
      storedRun.documentationTreePath,
      'DOCUMENTATION_RESULT_ARTIFACT_MISSING',
      'Documentation result artifact is unavailable.'
    );

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
    const rendered = await this.readArtifactJsonFile<RenderedDocumentation>(
      renderedPath,
      'DOCUMENTATION_DOWNLOAD_ARTIFACT_MISSING',
      'Documentation download artifact is unavailable.'
    );

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

      try {
        await this.removeRunDirectory(storedRun);
      } catch (error) {
        this.logCleanupRunFailure(storedRun.run.id, error);
        continue;
      }
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
      const message =
        error instanceof Error
          ? sanitizePublicErrorText(error.message, { fallback: 'Unknown cleanup failure.' })
          : 'Unknown cleanup failure.';
      this.logger.warn(`Documentation run cleanup failed: ${message}`);
    }
  }

  private async removeRunDirectory(storedRun: StoredRun): Promise<void> {
    await rm(storedRun.tempPath, {
      recursive: true,
      force: true
    });
  }

  private logCleanupRunFailure(runId: string, error: unknown): void {
    const message =
      error instanceof Error
        ? sanitizePublicErrorText(error.message, { fallback: 'Unknown cleanup failure.' })
        : 'Unknown cleanup failure.';
    this.logger.warn(`Documentation run cleanup failed for ${runId}: ${message}`);
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
    const now = new Date().toISOString();
    storedRun.run.updatedAt = now;
    if (status === 'completed') {
      storedRun.run.completedAt = storedRun.run.completedAt ?? now;
    }
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

  private async failRun(storedRun: StoredRun): Promise<void> {
    storedRun.run.error = safeRunError();
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

  private async readArtifactJsonFile<TValue>(
    filePath: string,
    code: string,
    message: string
  ): Promise<TValue> {
    try {
      return await this.readJsonFile<TValue>(filePath);
    } catch {
      throw new BadRequestException({
        code,
        message
      });
    }
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
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => left.localeCompare(right));
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

function safeRunError(): DocumentationRunError {
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

function toRunSummary(run: DocumentationRun): DocumentationRunSummary {
  return {
    id: sanitizePublicErrorText(run.id, { fallback: '[REDACTED]' }),
    name: sanitizePublicErrorText(run.name, { fallback: '[REDACTED]' }),
    status: run.status,
    sources: run.sources.map((source) => ({
      ...(source.id
        ? {
            id: sanitizePublicErrorText(source.id, { fallback: '[REDACTED]' })
          }
        : {}),
      name: sanitizePublicErrorText(source.name, { fallback: '[REDACTED]' }),
      role: source.role
    })),
    sourceCount: run.sources.length,
    outputFormats: [...run.options.outputFormats],
    ...(run.renderedFormats ? { renderedFormats: [...run.renderedFormats] } : {}),
    ...(run.progress ? { progress: run.progress } : {}),
    ...(run.error
      ? {
          error: {
            ...run.error,
            message: sanitizePublicErrorText(run.error.message, {
              fallback: 'Documentation generation failed.'
            })
          }
        }
      : {}),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    ...(run.completedAt ? { completedAt: run.completedAt } : {})
  };
}

function sortRunSummaries(runs: DocumentationRunSummary[], sort: RunListSort): DocumentationRunSummary[] {
  return [...runs].sort((left, right) => compareRunSummaryOrder(left, right, sort));
}

function compareRunSummaryToCursor(
  run: DocumentationRunSummary,
  cursor: RunListCursor,
  sort: RunListSort
): number {
  return compareRunSummaryOrder(run, cursor, sort);
}

function compareRunSummaryOrder(
  left: Pick<DocumentationRunSummary, 'id' | 'createdAt' | 'updatedAt'>,
  right: Pick<DocumentationRunSummary, 'id' | 'createdAt' | 'updatedAt'> | RunListCursor,
  sort: RunListSort
): number {
  const { field, direction } = parseRunListSortParts(sort);
  const leftSortValue = left[field];
  const rightSortValue = field === 'createdAt' ? right.createdAt ?? right.updatedAt : right.updatedAt;
  const sortValueOrder = leftSortValue.localeCompare(rightSortValue);
  if (sortValueOrder !== 0) {
    return direction === 'asc' ? sortValueOrder : -sortValueOrder;
  }

  const idOrder = left.id.localeCompare(right.id);
  return direction === 'asc' ? idOrder : -idOrder;
}

function parseRunListSortParts(sort: RunListSort): {
  field: RunListSortField;
  direction: RunListSortDirection;
} {
  const [field, direction] = sort.split(':') as [RunListSortField, RunListSortDirection];
  return {
    field,
    direction
  };
}

function encodeRunListCursor(run: DocumentationRunSummary): string {
  return Buffer.from(
    JSON.stringify({
      updatedAt: run.updatedAt,
      createdAt: run.createdAt,
      id: run.id
    }),
    'utf8'
  ).toString('base64url');
}

function assertSupportedArchiveFile(fileName: string): void {
  if (isSupportedSourceArchiveFileName(fileName)) {
    return;
  }

  throw new BadRequestException({
    code: 'SOURCE_ARCHIVE_UNSUPPORTED_TYPE',
    message: `Unsupported source archive type: ${fileName}.`,
    suggestion: `Upload one of the supported archive types: ${supportedSourceArchiveExtensions.join(', ')}.`
  });
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

function parseRunListLimit(value: unknown): number {
  if (value === undefined) {
    return defaultDocumentationRunListLimit;
  }

  if (Array.isArray(value)) {
    throw invalidRunListLimit();
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (
    !Number.isInteger(parsed) ||
    parsed < 1 ||
    parsed > maxDocumentationRunListLimit ||
    String(value).trim() !== String(parsed)
  ) {
    throw invalidRunListLimit();
  }

  return parsed;
}

function invalidRunListLimit(): BadRequestException {
  return new BadRequestException({
    code: 'RUN_LIST_LIMIT_INVALID',
    message: `Run list limit must be an integer between 1 and ${maxDocumentationRunListLimit}.`,
    details: {
      min: 1,
      max: maxDocumentationRunListLimit
    }
  });
}

function parseRunListStatus(value: unknown): DocumentationRunStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw invalidRunListStatus();
  }

  const status = String(value);
  if (!runListFilterStatuses.includes(status as DocumentationRunStatus)) {
    throw invalidRunListStatus();
  }

  return status as DocumentationRunStatus;
}

function invalidRunListStatus(): BadRequestException {
  return new BadRequestException({
    code: 'RUN_LIST_STATUS_INVALID',
    message: 'Run list status must be a supported documentation run status.',
    details: {
      allowedStatuses: [...runListFilterStatuses]
    }
  });
}

function parseRunListSourceRole(value: unknown): SourceRole | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw invalidRunListSourceRole();
  }

  const parsed = sourceRoleSchema.safeParse(String(value));
  if (!parsed.success) {
    throw invalidRunListSourceRole();
  }

  return parsed.data;
}

function invalidRunListSourceRole(): BadRequestException {
  return new BadRequestException({
    code: 'RUN_LIST_SOURCE_ROLE_INVALID',
    message: 'Run list source role must be a supported source role.',
    details: {
      allowedRoles: [...sourceRoleSchema.options]
    }
  });
}

function parseRunListName(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw invalidRunListName();
  }

  const name = String(value).trim();
  if (name.length === 0 || name.length > maxRunListNameLength) {
    throw invalidRunListName();
  }

  return name.toLowerCase();
}

function invalidRunListName(): BadRequestException {
  return new BadRequestException({
    code: 'RUN_LIST_NAME_INVALID',
    message: `Run list name filter must be between 1 and ${maxRunListNameLength} characters.`
  });
}

function parseRunListFormat(value: unknown): DocumentationOutputFormat | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw invalidRunListFormat();
  }

  const parsed = documentationOutputFormatSchema.safeParse(String(value));
  if (!parsed.success) {
    throw invalidRunListFormat();
  }

  return parsed.data;
}

function invalidRunListFormat(): BadRequestException {
  return new BadRequestException({
    code: 'RUN_LIST_FORMAT_INVALID',
    message: 'Run list format must be a supported documentation output format.',
    details: {
      allowedFormats: [...documentationOutputFormatSchema.options]
    }
  });
}

function runSummaryIncludesFormat(
  summary: DocumentationRunSummary,
  format: DocumentationOutputFormat
): boolean {
  return (
    summary.outputFormats.includes(format) || (summary.renderedFormats?.includes(format) ?? false)
  );
}

function parseRunListSourceCountRange(
  minSourcesValue: unknown,
  maxSourcesValue: unknown
): { minSources?: number; maxSources?: number } {
  const minSources = parseRunListSourceCount(minSourcesValue);
  const maxSources = parseRunListSourceCount(maxSourcesValue);

  if (minSources !== undefined && maxSources !== undefined && minSources > maxSources) {
    throw invalidRunListSourceCount();
  }

  return {
    ...(minSources === undefined ? {} : { minSources }),
    ...(maxSources === undefined ? {} : { maxSources })
  };
}

function parseRunListSourceCount(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw invalidRunListSourceCount();
  }

  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isSafeInteger(parsed) || parsed < 0 || String(value).trim() !== String(parsed)) {
    throw invalidRunListSourceCount();
  }

  return parsed;
}

function invalidRunListSourceCount(): BadRequestException {
  return new BadRequestException({
    code: 'RUN_LIST_SOURCE_COUNT_INVALID',
    message:
      'Run list source count filters must be non-negative integers, and minSources must not exceed maxSources.',
    details: {
      min: 0
    }
  });
}

function parseRunListSort(value: unknown): RunListSort {
  if (value === undefined) {
    return 'updatedAt:desc';
  }

  if (Array.isArray(value)) {
    throw invalidRunListSort();
  }

  const sort = String(value);
  if (!runListSortOptions.includes(sort as RunListSort)) {
    throw invalidRunListSort();
  }

  return sort as RunListSort;
}

function invalidRunListSort(): BadRequestException {
  return new BadRequestException({
    code: 'RUN_LIST_SORT_INVALID',
    message: 'Run list sort must be a supported sort option.',
    details: {
      allowedSorts: [...runListSortOptions]
    }
  });
}

function parseRunListCursor(value: unknown): RunListCursor | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw invalidRunListCursor();
  }

  const rawCursor = String(value);
  if (rawCursor.length === 0 || rawCursor.length > maxRunListCursorLength) {
    throw invalidRunListCursor();
  }

  try {
    const decoded = JSON.parse(Buffer.from(rawCursor, 'base64url').toString('utf8'));
    const parsed = runListCursorSchema.safeParse(decoded);
    if (!parsed.success) {
      throw invalidRunListCursor();
    }

    return parsed.data;
  } catch {
    throw invalidRunListCursor();
  }
}

function invalidRunListCursor(): BadRequestException {
  return new BadRequestException({
    code: 'RUN_LIST_CURSOR_INVALID',
    message: 'Run list cursor is invalid.'
  });
}

function parseRunListCreatedAfter(value: unknown): number | undefined {
  return parseRunListTimestamp(
    value,
    'RUN_LIST_CREATED_AFTER_INVALID',
    'Run list createdAfter must be a valid ISO timestamp.'
  );
}

function parseRunListCreatedBefore(value: unknown): number | undefined {
  return parseRunListTimestamp(
    value,
    'RUN_LIST_CREATED_BEFORE_INVALID',
    'Run list createdBefore must be a valid ISO timestamp.'
  );
}

function parseRunListCompletedAfter(value: unknown): number | undefined {
  return parseRunListTimestamp(
    value,
    'RUN_LIST_COMPLETED_AFTER_INVALID',
    'Run list completedAfter must be a valid ISO timestamp.'
  );
}

function parseRunListCompletedBefore(value: unknown): number | undefined {
  return parseRunListTimestamp(
    value,
    'RUN_LIST_COMPLETED_BEFORE_INVALID',
    'Run list completedBefore must be a valid ISO timestamp.'
  );
}

function parseRunListUpdatedAfter(value: unknown): number | undefined {
  return parseRunListTimestamp(
    value,
    'RUN_LIST_UPDATED_AFTER_INVALID',
    'Run list updatedAfter must be a valid ISO timestamp.'
  );
}

function parseRunListUpdatedBefore(value: unknown): number | undefined {
  return parseRunListTimestamp(
    value,
    'RUN_LIST_UPDATED_BEFORE_INVALID',
    'Run list updatedBefore must be a valid ISO timestamp.'
  );
}

function parseRunListTimestamp(
  value: unknown,
  code: string,
  message: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (Array.isArray(value)) {
    throw invalidRunListTimestamp(code, message);
  }

  const timestamp = String(value);
  const validation = runListTimestampSchema.safeParse(timestamp);
  if (!validation.success) {
    throw invalidRunListTimestamp(code, message);
  }

  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed)) {
    throw invalidRunListTimestamp(code, message);
  }

  return parsed;
}

function invalidRunListTimestamp(code: string, message: string): BadRequestException {
  return new BadRequestException({
    code,
    message
  });
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
