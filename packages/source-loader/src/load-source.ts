import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  LoadedSource,
  SkippedSourceFile,
  SourceFile,
  SourceInputMetadata,
  SourceLoadLimits
} from '@codebase-docs-ai/shared';
import { safeExtractArchive } from './safe-archive.js';
import { SourceLimitExceededError } from './source-loader-errors.js';
import { assertPathInsideRoot, toPortablePath } from './path-safety.js';

export const defaultSourceLoadLimits: SourceLoadLimits = {
  maxFiles: 5000,
  maxFileSizeBytes: 2 * 1024 * 1024,
  maxTotalSizeBytes: 100 * 1024 * 1024
};

export interface LoadFolderSourceInput {
  source: SourceInputMetadata;
  folderPath: string;
  limits?: Partial<SourceLoadLimits>;
}

export interface LoadArchiveSourceInput {
  source: SourceInputMetadata;
  archivePath: string;
  extractionRoot: string;
  limits?: Partial<SourceLoadLimits>;
}

export async function loadFolderSource(input: LoadFolderSourceInput): Promise<LoadedSource> {
  const limits = mergeSourceLoadLimits(input.limits);
  const rootPath = path.resolve(input.folderPath);
  const inventory = await buildFileInventory(rootPath, limits);

  return {
    source: input.source,
    rootPath,
    files: inventory.files,
    skippedFiles: inventory.skippedFiles,
    totalSizeBytes: inventory.totalSizeBytes
  };
}

export async function loadArchiveSource(input: LoadArchiveSourceInput): Promise<LoadedSource> {
  const limits = mergeSourceLoadLimits(input.limits);
  const destinationPath = path.resolve(input.extractionRoot, sanitizeSourceName(input.source.name));
  await safeExtractArchive({
    archivePath: input.archivePath,
    destinationPath,
    limits
  });

  return loadFolderSource({
    source: input.source,
    folderPath: destinationPath,
    limits
  });
}

function mergeSourceLoadLimits(limits?: Partial<SourceLoadLimits>): SourceLoadLimits {
  return {
    ...defaultSourceLoadLimits,
    ...limits
  };
}

async function buildFileInventory(
  rootPath: string,
  limits: SourceLoadLimits
): Promise<{
  files: SourceFile[];
  skippedFiles: SkippedSourceFile[];
  totalSizeBytes: number;
}> {
  const files: SourceFile[] = [];
  const skippedFiles: SkippedSourceFile[] = [];
  let totalSizeBytes = 0;

  async function visit(directoryPath: string): Promise<void> {
    const entries = await readdir(directoryPath, {
      withFileTypes: true
    });

    for (const entry of entries) {
      const absolutePath = path.join(directoryPath, entry.name);
      assertPathInsideRoot(rootPath, absolutePath);

      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }

      if (!entry.isFile()) {
        skippedFiles.push({
          path: relativeSourcePath(rootPath, absolutePath),
          reason: 'not_regular_file'
        });
        continue;
      }

      const fileStat = await stat(absolutePath);
      const relativePath = relativeSourcePath(rootPath, absolutePath);

      if (fileStat.size > limits.maxFileSizeBytes) {
        skippedFiles.push({
          path: relativePath,
          reason: 'file_size_limit_exceeded'
        });
        continue;
      }

      if (files.length + 1 > limits.maxFiles) {
        throw new SourceLimitExceededError(`Source exceeds file count limit of ${limits.maxFiles}`);
      }

      if (totalSizeBytes + fileStat.size > limits.maxTotalSizeBytes) {
        throw new SourceLimitExceededError(
          `Source exceeds total size limit of ${limits.maxTotalSizeBytes} bytes`
        );
      }

      files.push({
        path: relativePath,
        absolutePath,
        sizeBytes: fileStat.size,
        extension: path.extname(entry.name).toLowerCase()
      });
      totalSizeBytes += fileStat.size;
    }
  }

  await visit(rootPath);

  return {
    files: files.sort((left, right) => left.path.localeCompare(right.path)),
    skippedFiles: skippedFiles.sort((left, right) => left.path.localeCompare(right.path)),
    totalSizeBytes
  };
}

function relativeSourcePath(rootPath: string, absolutePath: string): string {
  return toPortablePath(path.relative(rootPath, absolutePath));
}

function sanitizeSourceName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
