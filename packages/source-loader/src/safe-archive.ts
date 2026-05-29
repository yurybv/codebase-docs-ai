import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import AdmZip from 'adm-zip';
import * as tar from 'tar';
import type { ReadEntry } from 'tar';
import {
  getSupportedSourceArchiveExtension,
  type SourceLoadLimits
} from '@codebase-docs-ai/shared';
import { assertPathInsideRoot, assertSafeRelativePath } from './path-safety.js';
import { SourceLimitExceededError, UnsupportedArchiveError } from './source-loader-errors.js';

export interface SafeExtractArchiveInput {
  archivePath: string;
  destinationPath: string;
  limits: SourceLoadLimits;
}

interface ArchiveEntrySummary {
  path: string;
  sizeBytes: number;
}

export async function safeExtractArchive(input: SafeExtractArchiveInput): Promise<void> {
  const archivePath = path.resolve(input.archivePath);
  const destinationPath = path.resolve(input.destinationPath);

  await mkdir(destinationPath, {
    recursive: true
  });

  const archiveExtension = getSupportedSourceArchiveExtension(archivePath);

  if (archiveExtension === '.zip') {
    await extractZipArchive(archivePath, destinationPath, input.limits);
    return;
  }

  if (
    archiveExtension === '.tar' ||
    archiveExtension === '.tar.gz' ||
    archiveExtension === '.tgz'
  ) {
    await extractTarArchive(archivePath, destinationPath, input.limits);
    return;
  }

  throw new UnsupportedArchiveError(input.archivePath);
}

async function extractZipArchive(
  archivePath: string,
  destinationPath: string,
  limits: SourceLoadLimits
): Promise<void> {
  const archive = new AdmZip(archivePath);
  const entries = archive.getEntries();
  validateArchiveEntries(
    entries.map((entry) => ({
      path: entry.entryName,
      sizeBytes: entry.header.size
    })),
    limits
  );

  for (const entry of entries) {
    const relativePath = assertSafeRelativePath(entry.entryName);
    const targetPath = path.resolve(destinationPath, relativePath);
    assertPathInsideRoot(destinationPath, targetPath);

    if (entry.isDirectory) {
      await mkdir(targetPath, {
        recursive: true
      });
      continue;
    }

    if (isZipSymlink(entry.header.attr)) {
      throw new SourceLimitExceededError(
        `Archive contains unsupported symlink: ${entry.entryName}`
      );
    }

    await mkdir(path.dirname(targetPath), {
      recursive: true
    });
    await writeFile(targetPath, entry.getData());
  }
}

async function extractTarArchive(
  archivePath: string,
  destinationPath: string,
  limits: SourceLoadLimits
): Promise<void> {
  const entries: ArchiveEntrySummary[] = [];

  await tar.t({
    file: archivePath,
    onentry: (entry: ReadEntry) => {
      if (entry.type === 'SymbolicLink' || entry.type === 'Link') {
        throw new SourceLimitExceededError(`Archive contains unsupported link: ${entry.path}`);
      }

      entries.push({
        path: entry.path,
        sizeBytes: entry.size
      });
    }
  });

  validateArchiveEntries(entries, limits);

  await tar.x({
    file: archivePath,
    cwd: destinationPath,
    strict: true,
    filter: (entryPath: string) => {
      const relativePath = assertSafeRelativePath(entryPath);
      const targetPath = path.resolve(destinationPath, relativePath);
      assertPathInsideRoot(destinationPath, targetPath);
      return true;
    }
  });
}

function validateArchiveEntries(entries: ArchiveEntrySummary[], limits: SourceLoadLimits): void {
  let totalSizeBytes = 0;
  let fileCount = 0;

  for (const entry of entries) {
    assertSafeRelativePath(entry.path);

    if (entry.path.endsWith('/')) {
      continue;
    }

    fileCount += 1;
    totalSizeBytes += entry.sizeBytes;

    if (entry.sizeBytes > limits.maxFileSizeBytes) {
      throw new SourceLimitExceededError(
        `Archive entry exceeds file size limit of ${limits.maxFileSizeBytes} bytes`
      );
    }
  }

  if (fileCount > limits.maxFiles) {
    throw new SourceLimitExceededError(`Archive exceeds file count limit of ${limits.maxFiles}`);
  }

  if (totalSizeBytes > limits.maxTotalSizeBytes) {
    throw new SourceLimitExceededError(
      `Archive exceeds total size limit of ${limits.maxTotalSizeBytes} bytes`
    );
  }
}

function isZipSymlink(attributes: number): boolean {
  const unixMode = attributes >>> 16;
  const fileType = unixMode & 0o170000;
  return fileType === 0o120000;
}
