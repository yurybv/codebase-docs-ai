import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { generateDocumentationTree } from '@codebase-docs-ai/documentation-generator';
import { renderJson, renderMarkdownTree, renderSingleMarkdown, renderZip } from '@codebase-docs-ai/renderers';
import { analyzeRepository } from '@codebase-docs-ai/repo-analyzer';
import { filterLoadedSource } from '@codebase-docs-ai/security';
import {
  createDocumentationRunSchema,
  documentationOutputFormatSchema,
  sourceInputMetadataSchema
} from '@codebase-docs-ai/shared';
import type {
  DocumentationOutputFormat,
  DocumentationRun,
  DocumentationRunOptions,
  DocumentationRunStatus,
  DocumentationTree,
  RenderedDocumentation,
  SourceInputMetadata
} from '@codebase-docs-ai/shared';
import { loadArchiveSource } from '@codebase-docs-ai/source-loader';
import { analyzeSystem } from '@codebase-docs-ai/system-analyzer';
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
  documentationTree?: DocumentationTree;
  rendered?: Map<DocumentationOutputFormat, RenderedDocumentation>;
  tempPath: string;
}

interface DownloadResult {
  fileName: string;
  mediaType: string;
  content: string | Buffer;
}

const uploadSourcesMetadataSchema = z.object({
  sources: z.array(
    sourceInputMetadataSchema.extend({
      fileField: z.string().min(1)
    })
  )
});

@Injectable()
export class DocumentationRunsService {
  private readonly runs = new Map<string, StoredRun>();
  private readonly tempRoot = path.resolve(process.env.DOCS_AI_TMP_DIR ?? '.tmp/codebase-docs-ai');

  createRun(body: unknown): { runId: string; status: DocumentationRunStatus } {
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

    this.runs.set(runId, {
      run,
      sources: [],
      tempPath: path.join(this.tempRoot, runId)
    });

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
    const storedRun = this.requireRun(runId);
    const parsedMetadata = uploadSourcesMetadataSchema.safeParse(parseJson(metadataJson));
    if (!parsedMetadata.success) {
      throw new BadRequestException({
        code: 'INVALID_SOURCE_METADATA',
        message: 'Source upload metadata is invalid.',
        details: parsedMetadata.error.flatten()
      });
    }

    const uploadPath = path.join(storedRun.tempPath, 'uploads');
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
    this.setStatus(storedRun, 'ready');

    return {
      runId,
      status: storedRun.run.status,
      sources: storedRun.run.sources
    };
  }

  async startRun(runId: string): Promise<{ runId: string; status: DocumentationRunStatus }> {
    const storedRun = this.requireRun(runId);
    if (storedRun.sources.length === 0) {
      throw new BadRequestException({
        code: 'NO_SOURCES_UPLOADED',
        message: 'Upload at least one source archive before starting the run.'
      });
    }

    this.setStatus(storedRun, 'running');
    this.setStatus(storedRun, 'extracting_sources');

    const loadedSources = await Promise.all(
      storedRun.sources.map((source) =>
        loadArchiveSource({
          source: source.metadata,
          archivePath: source.archivePath,
          extractionRoot: path.join(storedRun.tempPath, 'extracted')
        })
      )
    );

    this.setStatus(storedRun, 'analyzing_sources');
    const repositoryMaps = await Promise.all(
      loadedSources.map((loadedSource) => {
        const filteredSource = filterLoadedSource(loadedSource);
        return analyzeRepository({
          source: loadedSource.source,
          rootPath: loadedSource.rootPath,
          files: filteredSource.includedFiles
        });
      })
    );

    this.setStatus(storedRun, 'building_system_map');
    const systemMap = analyzeSystem({
      repositories: repositoryMaps
    });

    this.setStatus(storedRun, 'generating_documentation');
    const documentationTree = generateDocumentationTree({
      title: storedRun.run.name,
      systemMap
    });

    this.setStatus(storedRun, 'rendering_output');
    storedRun.documentationTree = documentationTree;
    storedRun.rendered = renderDocumentation(documentationTree, storedRun.run.options);
    this.setStatus(storedRun, 'completed');

    return {
      runId,
      status: storedRun.run.status
    };
  }

  getRun(runId: string): DocumentationRun {
    return this.requireRun(runId).run;
  }

  getResult(runId: string): { runId: string; status: DocumentationRunStatus; documentation: DocumentationTree } {
    const storedRun = this.requireRun(runId);
    if (!storedRun.documentationTree) {
      throw new BadRequestException({
        code: 'DOCUMENTATION_NOT_READY',
        message: 'Documentation result is not ready yet.'
      });
    }

    return {
      runId,
      status: storedRun.run.status,
      documentation: storedRun.documentationTree
    };
  }

  getDownload(runId: string, format: string): DownloadResult {
    const storedRun = this.requireRun(runId);
    if (!storedRun.rendered) {
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

    const rendered = storedRun.rendered.get(parsedFormat.data);
    if (!rendered) {
      throw new BadRequestException({
        code: 'OUTPUT_FORMAT_NOT_RENDERED',
        message: `Output format was not rendered for this run: ${format}.`
      });
    }

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
    const storedRun = this.requireRun(runId);
    await rm(storedRun.tempPath, {
      recursive: true,
      force: true
    });
    this.runs.delete(runId);
  }

  private requireRun(runId: string): StoredRun {
    const storedRun = this.runs.get(runId);
    if (!storedRun) {
      throw new NotFoundException({
        code: 'DOCUMENTATION_RUN_NOT_FOUND',
        message: `Documentation run was not found: ${runId}.`
      });
    }

    return storedRun;
  }

  private setStatus(storedRun: StoredRun, status: DocumentationRunStatus): void {
    storedRun.run.status = status;
    storedRun.run.updatedAt = new Date().toISOString();
  }
}

function renderDocumentation(
  documentationTree: DocumentationTree,
  options: DocumentationRunOptions
): Map<DocumentationOutputFormat, RenderedDocumentation> {
  const rendered = new Map<DocumentationOutputFormat, RenderedDocumentation>();

  for (const format of options.outputFormats) {
    if (format === 'markdown-tree') {
      rendered.set(format, renderMarkdownTree(documentationTree));
    }

    if (format === 'single-markdown') {
      rendered.set(format, renderSingleMarkdown(documentationTree));
    }

    if (format === 'json') {
      rendered.set(format, renderJson(documentationTree));
    }
  }

  return rendered;
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
